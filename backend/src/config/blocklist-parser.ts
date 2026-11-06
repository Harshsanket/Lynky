import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { BlocklistFormat } from "./blocklist-formats.js";
import { isValidHostname, normalizeHostname } from "./hostname.js";

/**
 * Pure text-blocklist parser shared by the build validator and compiler.
 *
 * It never throws for bad input: malformed lines are counted and sampled so
 * the validator can report an actionable file/line, while the compiler can
 * decide whether the reject ratio is acceptable.
 */

export const MAX_BLOCKLIST_FILE_BYTES = 25 * 1024 * 1024;

export interface BlocklistSourceConfig {
  file: string;
  format: BlocklistFormat;
  required: boolean;
  minEntries: number;
  sourceUrl?: string | undefined;
  license?: string | undefined;
  fetchedAt?: string | undefined;
  sha256?: string | undefined;
}

export interface ParsedLine {
  host?: string;
  urlKey?: string;
  /** Format detected for an `auto` source. */
  detected?: Exclude<BlocklistFormat, "auto">;
  skip: boolean;
}

export interface ParsedBlocklistSource {
  config: BlocklistSourceConfig;
  present: boolean;
  error: string | null;
  bytes: number;
  sha256: string | null;
  totalLines: number;
  consideredLines: number;
  parsedLines: number;
  skippedLines: number;
  rejectedLines: number;
  duplicates: number;
  rejectedExamples: Array<{ line: number; text: string; reason: string }>;
  hosts: string[];
  urls: string[];
}

export interface ParsedBlocklists {
  sources: ParsedBlocklistSource[];
  hosts: string[];
  urls: string[];
  stats: {
    sourceLines: number;
    uniqueHosts: number;
    uniqueUrls: number;
    duplicates: number;
    rejectedLines: number;
  };
}

const HOSTS_FILE_LINE = /^(?:\d{1,3}\.){3}\d{1,3}\s+(\S+)(?:\s+#.*)?$/;
const FULL_URL_LINE = /^https?:\/\//i;
const ADBLOCK_LINE = /^\|\|/;
const WILDCARD_LINE = /^\*\./;

const stripAdblock = (line: string): string | null => {
  if (line.startsWith("@@")) {
    return null;
  }

  if (!line.startsWith("||")) {
    return null;
  }

  return line.slice(2).replace(/\^.*$/, "").replace(/\$.*$/, "");
};

const stripWildcard = (line: string): string => {
  const withoutWildcard = line.startsWith("*.")
    ? line.slice(2)
    : line;

  return withoutWildcard.replace(/\s+#.*$/, "").trim();
};

const parseUrlEntry = (
  value: string
): { host: string; urlKey: string } | null => {
  try {
    const parsed = new URL(value);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    const host = normalizeHostname(parsed.hostname);

    if (!isValidHostname(host)) {
      return null;
    }

    return {
      host,
      urlKey: `${parsed.host}${parsed.pathname}${parsed.search}`,
    };
  } catch {
    return null;
  }
};

const parseDomainEntry = (value: string): string | null => {
  const candidate = normalizeHostname(stripWildcard(value));

  if (!candidate || !isValidHostname(candidate)) {
    return null;
  }

  return candidate;
};

const detectFormat = (line: string): Exclude<BlocklistFormat, "auto"> | null => {
  if (FULL_URL_LINE.test(line)) {
    return "full-urls";
  }

  if (ADBLOCK_LINE.test(line)) {
    return "adblock";
  }

  if (HOSTS_FILE_LINE.test(line)) {
    return "hosts-file";
  }

  if (WILDCARD_LINE.test(line)) {
    return "wildcard-domains";
  }

  if (isValidHostname(stripWildcard(line))) {
    return "domains";
  }

  return null;
};

const parseLine = (
  rawLine: string,
  format: BlocklistFormat
): ParsedLine => {
  const line = rawLine.trim();

  if (
    !line ||
    line.startsWith("#") ||
    line.startsWith("!") ||
    line.startsWith(";")
  ) {
    return { skip: true };
  }

  const effectiveFormat = format === "auto" ? detectFormat(line) : format;

  if (!effectiveFormat) {
    return { skip: false };
  }

  if (effectiveFormat === "full-urls") {
    const parsed = parseUrlEntry(line);
    return parsed
      ? { ...parsed, detected: "full-urls", skip: false }
      : { skip: false };
  }

  if (effectiveFormat === "hosts-file") {
    const match = line.match(HOSTS_FILE_LINE);
    const host = match?.[1]
      ? normalizeHostname(match[1])
      : null;

    return host && isValidHostname(host)
      ? { host, detected: "hosts-file", skip: false }
      : { skip: false };
  }

  if (effectiveFormat === "adblock") {
    const entry = stripAdblock(line);

    if (entry === null) {
      return { skip: true };
    }

    const parsed = parseUrlEntry(
      FULL_URL_LINE.test(entry) ? entry : `http://${entry}`
    );

    if (!parsed) {
      return { skip: false };
    }

    const host = normalizeHostname(entry);

    return FULL_URL_LINE.test(entry)
      ? { ...parsed, detected: "adblock", skip: false }
      : { host, detected: "adblock", skip: false };
  }

  // domains / wildcard-domains
  const host = parseDomainEntry(line);

  return host
    ? {
        host,
        detected:
          effectiveFormat === "wildcard-domains" || WILDCARD_LINE.test(line)
            ? "wildcard-domains"
            : "domains",
        skip: false,
      }
    : { skip: false };
};

const decodeUtf8 = (
  buffer: Buffer
): { text: string } | { error: string } => {
  try {
    return {
      text: new TextDecoder("utf-8", { fatal: true }).decode(buffer),
    };
  } catch (error) {
    return { error: (error as Error).message };
  }
};

export const parseBlocklistSource = (
  configRoot: string,
  config: BlocklistSourceConfig
): ParsedBlocklistSource => {
  const filePath = path.join(configRoot, "blocklists", config.file);
  const result: ParsedBlocklistSource = {
    config,
    present: false,
    error: null,
    bytes: 0,
    sha256: null,
    totalLines: 0,
    consideredLines: 0,
    parsedLines: 0,
    skippedLines: 0,
    rejectedLines: 0,
    duplicates: 0,
    rejectedExamples: [],
    hosts: [],
    urls: [],
  };

  if (!fs.existsSync(filePath)) {
    return result;
  }

  result.present = true;

  const stat = fs.statSync(filePath);

  if (!stat.isFile()) {
    result.error = "not a regular file";
    return result;
  }

  if (stat.size > MAX_BLOCKLIST_FILE_BYTES) {
    result.error = `larger than ${MAX_BLOCKLIST_FILE_BYTES} bytes`;
    return result;
  }

  const buffer = fs.readFileSync(filePath);

  result.bytes = buffer.byteLength;
  result.sha256 = crypto
    .createHash("sha256")
    .update(buffer)
    .digest("hex");

  const decoded = decodeUtf8(buffer);

  if ("error" in decoded) {
    result.error = `invalid UTF-8: ${decoded.error}`;
    result.rejectedLines = 1;
    result.rejectedExamples.push({
      line: 0,
      text: "<invalid utf-8>",
      reason: decoded.error,
    });

    return result;
  }

  const seenHosts = new Set<string>();
  const seenUrls = new Set<string>();
  const lines = decoded.text.split(/\r?\n/);

  result.totalLines = lines.length;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const parsed = parseLine(line, config.format);

    if (parsed.skip) {
      result.skippedLines++;
      continue;
    }

    result.consideredLines++;

    if (!parsed.host) {
      result.rejectedLines++;

      if (result.rejectedExamples.length < 5) {
        result.rejectedExamples.push({
          line: index + 1,
          text: line.slice(0, 160),
          reason: "line does not match the declared format",
        });
      }

      continue;
    }

    result.parsedLines++;

    if (seenHosts.has(parsed.host)) {
      result.duplicates++;
    } else {
      seenHosts.add(parsed.host);
      result.hosts.push(parsed.host);
    }

    if (parsed.urlKey) {
      if (seenUrls.has(parsed.urlKey)) {
        result.duplicates++;
      } else {
        seenUrls.add(parsed.urlKey);
        result.urls.push(parsed.urlKey);
      }
    }
  }

  return result;
};

export const parseBlocklists = (
  configRoot: string,
  sources: readonly BlocklistSourceConfig[]
): ParsedBlocklists => {
  const parsedSources = sources.map((source) =>
    parseBlocklistSource(configRoot, source)
  );

  const globalHosts = new Set<string>();
  const globalUrls = new Set<string>();
  let duplicates = 0;
  let rejectedLines = 0;
  let sourceLines = 0;

  for (const source of parsedSources) {
    sourceLines += source.totalLines;
    rejectedLines += source.rejectedLines;

    for (const host of source.hosts) {
      if (globalHosts.has(host)) {
        duplicates++;
      } else {
        globalHosts.add(host);
      }
    }

    for (const url of source.urls) {
      if (globalUrls.has(url)) {
        duplicates++;
      } else {
        globalUrls.add(url);
      }
    }
  }

  return {
    sources: parsedSources,
    hosts: [...globalHosts].sort(),
    urls: [...globalUrls].sort(),
    stats: {
      sourceLines,
      uniqueHosts: globalHosts.size,
      uniqueUrls: globalUrls.size,
      duplicates,
      rejectedLines,
    },
  };
};
