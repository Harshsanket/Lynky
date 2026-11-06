import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { env } from "../../src/config/env.js";
import type {
  ArtifactManifest,
  BlocklistHeader,
  BlocklistStatus,
} from "../../src/config/artifact-types.js";
import { hashKey } from "../../src/config/hash64.js";
import { logError } from "../logger.js";

interface CollisionEntry {
  hash: string;
  keys: string[];
}

export interface BlocklistCheck {
  blocked: boolean;
  status: BlocklistStatus;
  reason?: string;
}

export interface BlocklistState {
  decision: "allow" | "block";
  status: BlocklistStatus;
  reason?: string;
  counters: {
    load_errors: number;
    unavailable: number;
    blocked: number;
    allowed: number;
    degraded_lookups: number;
  };
}

const counters = {
  load_errors: 0,
  unavailable: 0,
  blocked: 0,
  allowed: 0,
  degraded_lookups: 0,
};

const hashString = (lo: number, hi: number): string =>
  `${lo.toString(16).padStart(8, "0")}${hi
    .toString(16)
    .padStart(8, "0")}`;

export class BlocklistEngine {
  readonly header: BlocklistHeader;
  private readonly indexKind: "mphf" | "sorted";
  private readonly seed: number;
  private readonly tableSize: number;
  private readonly displacements: Int32Array;
  private readonly verification: Uint32Array;
  private readonly sortedHashes: Uint32Array;
  private readonly collisions: Map<string, Set<string>>;
  private readonly urls: Set<string>;
  private status: BlocklistStatus = "ok";
  private reason: string | undefined;

  constructor(
    header: BlocklistHeader,
    buffers: {
      displacements?: Int32Array;
      verification?: Uint32Array;
      sortedHashes?: Uint32Array;
      collisions: CollisionEntry[];
      urls: string[];
    }
  ) {
    this.header = header;
    this.indexKind = header.indexKind;
    this.seed = header.seed;
    this.tableSize = header.tableSize;
    this.displacements = buffers.displacements ?? new Int32Array(0);
    this.verification = buffers.verification ?? new Uint32Array(0);
    this.sortedHashes = buffers.sortedHashes ?? new Uint32Array(0);
    this.collisions = new Map(
      buffers.collisions.map((entry) => [
        entry.hash,
        new Set(entry.keys),
      ])
    );
    this.urls = new Set(buffers.urls);
  }

  static unavailable(reason: string): BlocklistEngine {
    const engine = new BlocklistEngine(
      {
        indexKind: "mphf",
        seed: 0,
        bucketCount: 0,
        tableSize: 0,
        hostCount: 0,
        urlCount: 0,
        collisionCount: 0,
      },
      { collisions: [], urls: [] }
    );

    engine.markDegraded(reason);

    return engine;
  }

  markDegraded(reason: string): void {
    this.status = "degraded";
    this.reason = reason;
  }

  getState(): BlocklistState {
    const unavailable = this.status !== "ok";
    const decision =
      unavailable && env.BLOCKLIST_FAILURE_MODE === "closed"
        ? "block"
        : "allow";

    return {
      decision,
      status: this.status,
      ...(this.reason ? { reason: this.reason } : {}),
      counters: { ...counters },
    };
  }

  private checkCollision(hash: string, key: string): boolean {
    const collision = this.collisions.get(hash);

    if (!collision) {
      return true;
    }

    return collision.has(key);
  }

  private lookupMphf(hash: {
    h1: number;
    h2: number;
    lo: number;
    hi: number;
  }, key: string): boolean {
    if (this.header.bucketCount === 0 || this.tableSize === 0) {
      return false;
    }

    const bucket = hash.h1 % this.header.bucketCount;
    const displacement = this.displacements[bucket] ?? 0;

    if (displacement === 0) {
      return false;
    }

    const slot =
      (hash.h2 + displacement - 1) % this.tableSize;

    if (
      this.verification[slot * 2] !== hash.lo ||
      this.verification[slot * 2 + 1] !== hash.hi
    ) {
      return false;
    }

    return this.checkCollision(hashString(hash.lo, hash.hi), key);
  }

  private lookupSorted(hash: {
    lo: number;
    hi: number;
  }, key: string): boolean {
    let low = 0;
    let high = this.tableSize - 1;

    while (low <= high) {
      const middle = (low + high) >>> 1;
      const middleHi = this.sortedHashes[middle * 2 + 1]!;
      const middleLo = this.sortedHashes[middle * 2]!;

      if (hash.hi === middleHi && hash.lo === middleLo) {
        return this.checkCollision(
          hashString(hash.lo, hash.hi),
          key
        );
      }

      if (
        hash.hi < middleHi ||
        (hash.hi === middleHi && hash.lo < middleLo)
      ) {
        high = middle - 1;
      } else {
        low = middle + 1;
      }
    }

    return false;
  }

  private isBlockedHost(hostname: string): boolean {
    const host = hostname
      .toLowerCase()
      .replace(/^\[|\]$/g, "")
      .replace(/\.$/, "");

    if (!host) {
      return false;
    }

    if (this.header.hostCount === 0) {
      return false;
    }

    const labels = host.split(".");

    for (let index = 0; index < labels.length; index++) {
      const candidate = labels.slice(index).join(".");
      const hash = hashKey(candidate, this.seed);
      const matched =
        this.indexKind === "mphf"
          ? this.lookupMphf(hash, candidate)
          : this.lookupSorted(hash, candidate);

      if (matched) {
        return true;
      }
    }

    return false;
  }

  check(parsedUrl: URL): BlocklistCheck {
    if (this.status !== "ok") {
      counters.degraded_lookups++;

      if (env.BLOCKLIST_FAILURE_MODE === "closed") {
        counters.unavailable++;
        counters.blocked++;
        return {
          blocked: true,
          status: "closed",
          ...(this.reason ? { reason: this.reason } : {}),
        };
      }

      counters.unavailable++;
      counters.allowed++;
      return {
        blocked: false,
        status: "degraded",
        ...(this.reason ? { reason: this.reason } : {}),
      };
    }

    const urlKey = `${parsedUrl.host}${parsedUrl.pathname}${parsedUrl.search}`;
    const blocked =
      this.urls.has(urlKey) || this.isBlockedHost(parsedUrl.hostname);

    if (blocked) {
      counters.blocked++;
      return { blocked: true, status: "ok" };
    }

    counters.allowed++;
    return { blocked: false, status: "ok" };
  }
}

export class BlocklistLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlocklistLoadError";
  }
}

const readExact = (
  fd: number,
  buffer: Uint8Array,
  position: number
): void => {
  let total = 0;

  while (total < buffer.byteLength) {
    const bytesRead = fs.readSync(
      fd,
      buffer,
      total,
      buffer.byteLength - total,
      position + total
    );

    if (bytesRead === 0) {
      throw new BlocklistLoadError("unexpected end of blocklist artifact");
    }

    total += bytesRead;
  }
};

const readPayload = (
  fd: number,
  fileSize: number,
  position: number
): { value: Buffer; offset: number } => {
  if (position + 4 > fileSize) {
    throw new BlocklistLoadError("truncated length prefix");
  }

  const lengthBuffer = Buffer.allocUnsafe(4);
  readExact(fd, lengthBuffer, position);

  const length = lengthBuffer.readUInt32LE(0);
  const offset = position + 4;

  if (offset + length > fileSize) {
    throw new BlocklistLoadError("truncated payload");
  }

  const value = Buffer.allocUnsafe(length);
  readExact(fd, value, offset);

  return { value, offset: offset + length };
};

const assertHeader = (value: unknown): BlocklistHeader => {
  if (!value || typeof value !== "object") {
    throw new BlocklistLoadError("missing blocklist header");
  }

  const candidate = value as Record<string, unknown>;

  if (
    (candidate.indexKind !== "mphf" &&
      candidate.indexKind !== "sorted") ||
    !Number.isInteger(candidate.seed) ||
    !Number.isInteger(candidate.bucketCount) ||
    !Number.isInteger(candidate.tableSize) ||
    !Number.isInteger(candidate.hostCount) ||
    !Number.isInteger(candidate.urlCount) ||
    !Number.isInteger(candidate.collisionCount)
  ) {
    throw new BlocklistLoadError("invalid blocklist header");
  }

  const header = candidate as unknown as BlocklistHeader;

  if (
    header.bucketCount < 0 ||
    header.tableSize < 0 ||
    header.hostCount < 0 ||
    header.urlCount < 0 ||
    header.collisionCount < 0 ||
    header.bucketCount > 10_000_000 ||
    header.tableSize > 20_000_000
  ) {
    throw new BlocklistLoadError("blocklist header exceeds safe bounds");
  }

  if (
    header.indexKind === "mphf" &&
    header.tableSize !== 0 &&
    header.bucketCount === 0
  ) {
    throw new BlocklistLoadError("MPHF header has no buckets");
  }

  return header;
};

const parseBlocklistFile = (filePath: string): BlocklistEngine => {
  const fd = fs.openSync(filePath, "r");
  const stat = fs.fstatSync(fd);

  try {
    const fileSize = stat.size;

    if (fileSize < 16) {
      throw new BlocklistLoadError("blocklist artifact is truncated");
    }

    const prefix = Buffer.allocUnsafe(16);
    readExact(fd, prefix, 0);

    if (prefix.subarray(0, 8).toString("ascii") !== "LYNKYBL1") {
      throw new BlocklistLoadError("blocklist artifact magic mismatch");
    }

    if (prefix.readUInt32LE(8) !== 1) {
      throw new BlocklistLoadError("unsupported blocklist artifact version");
    }

    const headerLength = prefix.readUInt32LE(12);
    let offset = 16;

    if (offset + headerLength > fileSize) {
      throw new BlocklistLoadError("truncated blocklist header");
    }

    const headerBuffer = Buffer.allocUnsafe(headerLength);
    readExact(fd, headerBuffer, offset);
    offset += headerLength;

    let header: BlocklistHeader;

    try {
      header = assertHeader(
        JSON.parse(headerBuffer.toString("utf-8"))
      );
    } catch (error) {
      if (error instanceof BlocklistLoadError) {
        throw error;
      }

      throw new BlocklistLoadError(
        `invalid blocklist header JSON: ${(error as Error).message}`
      );
    }

    let displacements: Int32Array | undefined;
    let verification: Uint32Array | undefined;
    let sortedHashes: Uint32Array | undefined;

    if (header.indexKind === "mphf") {
      const displacementBytes = header.bucketCount * 4;
      const verificationBytes = header.tableSize * 8;

      if (offset + displacementBytes + verificationBytes > fileSize) {
        throw new BlocklistLoadError("truncated MPHF arrays");
      }

      displacements = new Int32Array(header.bucketCount);
      readExact(
        fd,
        new Uint8Array(
          displacements.buffer,
          displacements.byteOffset,
          displacements.byteLength
        ),
        offset
      );
      offset += displacementBytes;

      verification = new Uint32Array(header.tableSize * 2);
      readExact(
        fd,
        new Uint8Array(
          verification.buffer,
          verification.byteOffset,
          verification.byteLength
        ),
        offset
      );
      offset += verificationBytes;
    } else {
      const hashBytes = header.tableSize * 8;

      if (offset + hashBytes > fileSize) {
        throw new BlocklistLoadError("truncated sorted hash array");
      }

      sortedHashes = new Uint32Array(header.tableSize * 2);
      readExact(
        fd,
        new Uint8Array(
          sortedHashes.buffer,
          sortedHashes.byteOffset,
          sortedHashes.byteLength
        ),
        offset
      );
      offset += hashBytes;
    }

    const collisionsPayload = readPayload(fd, fileSize, offset);
    offset = collisionsPayload.offset;

    const urlPayload = readPayload(fd, fileSize, offset);
    offset = urlPayload.offset;

    if (offset !== fileSize) {
      throw new BlocklistLoadError("trailing bytes in blocklist artifact");
    }

    let collisions: CollisionEntry[];
    let urls: string[];

    try {
      collisions = JSON.parse(
        collisionsPayload.value.toString("utf-8")
      ) as CollisionEntry[];
      urls = JSON.parse(urlPayload.value.toString("utf-8")) as string[];
    } catch (error) {
      throw new BlocklistLoadError(
        `invalid blocklist JSON payload: ${(error as Error).message}`
      );
    }

    if (
      !Array.isArray(collisions) ||
      !Array.isArray(urls) ||
      collisions.length !== header.collisionCount ||
      urls.length !== header.urlCount
    ) {
      throw new BlocklistLoadError("blocklist counts do not match header");
    }

    if (
      header.indexKind === "mphf" &&
      (displacements?.length !== header.bucketCount ||
        verification?.length !== header.tableSize * 2)
    ) {
      throw new BlocklistLoadError("MPHF array lengths do not match header");
    }

    if (
      header.indexKind === "sorted" &&
      sortedHashes?.length !== header.tableSize * 2
    ) {
      throw new BlocklistLoadError("sorted array length does not match header");
    }

    return new BlocklistEngine(header, {
      ...(displacements ? { displacements } : {}),
      ...(verification ? { verification } : {}),
      ...(sortedHashes ? { sortedHashes } : {}),
      collisions,
      urls,
    });
  } finally {
    fs.closeSync(fd);
  }
};

const fileSha256 = (filePath: string): string => {
  const hash = crypto.createHash("sha256");
  const fd = fs.openSync(filePath, "r");
  const chunk = Buffer.allocUnsafe(1024 * 1024);

  try {
    let position = 0;

    while (true) {
      const bytesRead = fs.readSync(
        fd,
        chunk,
        0,
        chunk.byteLength,
        position
      );

      if (bytesRead === 0) {
        break;
      }

      hash.update(chunk.subarray(0, bytesRead));
      position += bytesRead;
    }
  } finally {
    fs.closeSync(fd);
  }

  return hash.digest("hex");
};

let lastKnownGood: BlocklistEngine | null = null;

export const loadBlocklistEngine = (
  compiledDir: string,
  manifest: ArtifactManifest,
  options: { verifyHash?: boolean } = {}
): BlocklistEngine => {
  const filePath = path.join(compiledDir, "blocklists.bin");

  try {
    if (!fs.existsSync(filePath)) {
      throw new BlocklistLoadError("blocklists.bin is missing");
    }

    const expected = manifest.artifactFiles?.["blocklists.bin"];

    if (options.verifyHash !== false && expected) {
      const actual = fileSha256(filePath);
      const size = fs.statSync(filePath).size;

      if (actual !== expected.sha256 || size !== expected.bytes) {
        throw new BlocklistLoadError(
          "blocklists.bin hash does not match the manifest"
        );
      }
    }

    const engine = parseBlocklistFile(filePath);

    lastKnownGood = engine;

    return engine;
  } catch (error) {
    counters.load_errors++;

    const reason = `blocklist unavailable: ${
      (error as Error).message
    }`;

    logError("blocklist_unavailable", error, {
      errorCode: "blocklist_unavailable",
      failureMode: env.BLOCKLIST_FAILURE_MODE,
      usingLastKnownGood: Boolean(lastKnownGood),
    });

    if (lastKnownGood) {
      lastKnownGood.markDegraded(reason);
      return lastKnownGood;
    }

    return BlocklistEngine.unavailable(reason);
  }
};
