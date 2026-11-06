import { hashKey } from "../../src/config/hash64.js";

/**
 * Small, deterministic CHD minimal-perfect-hash generator.
 *
 * This runs at build time only. Runtime lookup is a slot probe plus a 64-bit
 * verification comparison; no perfect-hash search happens in the request
 * path.
 */

export interface CollisionEntry {
  hash: string;
  keys: string[];
}

export interface MphfArtifact {
  indexKind: "mphf";
  seed: number;
  bucketCount: number;
  tableSize: number;
  displacements: Int32Array;
  verification: Uint32Array;
  collisions: CollisionEntry[];
}

export interface SortedArtifact {
  indexKind: "sorted";
  seed: number;
  tableSize: number;
  hashes: Uint32Array;
  collisions: CollisionEntry[];
}

export type BlocklistIndexArtifact = MphfArtifact | SortedArtifact;

export interface MphfOptions {
  seed?: number;
  lambda?: number;
  tableMultiplier?: number;
}

const DEFAULT_SEED = 0x9e3779b9;

const collisionEntries = (keys: readonly string[], seed: number): CollisionEntry[] => {
  const byHash = new Map<string, string[]>();

  for (const key of keys) {
    const hash = hashKey(key, seed);
    const value = `${hash.lo.toString(16).padStart(8, "0")}${hash.hi
      .toString(16)
      .padStart(8, "0")}`;
    const bucket = byHash.get(value);

    if (bucket) {
      bucket.push(key);
    } else {
      byHash.set(value, [key]);
    }
  }

  return [...byHash.entries()]
    .filter(([, values]) => values.length > 1)
    .map(([hash, values]) => ({
      hash,
      keys: [...values].sort(),
    }))
    .sort((left, right) => left.hash.localeCompare(right.hash));
};

export const buildMphf = (
  keys: readonly string[],
  options: MphfOptions = {}
): MphfArtifact => {
  if (keys.length === 0) {
    return {
      indexKind: "mphf",
      seed: options.seed ?? DEFAULT_SEED,
      bucketCount: 0,
      tableSize: 0,
      displacements: new Int32Array(0),
      verification: new Uint32Array(0),
      collisions: [],
    };
  }

  const sortedKeys = [...keys].sort();
  const seedBase = options.seed ?? DEFAULT_SEED;
  const lambdas = options.lambda ? [options.lambda] : [3, 4, 2, 5];
  const multipliers = options.tableMultiplier
    ? [options.tableMultiplier]
    : [1.1, 1.15, 1.2, 1.35, 1.5];
  const seeds = [seedBase, seedBase ^ 0x85ebca6b, seedBase ^ 0xc2b2ae35];

  for (const seed of seeds) {
    const h1 = new Uint32Array(sortedKeys.length);
    const h2 = new Uint32Array(sortedKeys.length);
    const lo = new Uint32Array(sortedKeys.length);
    const hi = new Uint32Array(sortedKeys.length);

    for (let index = 0; index < sortedKeys.length; index++) {
      const hash = hashKey(sortedKeys[index]!, seed);
      h1[index] = hash.h1;
      h2[index] = hash.h2;
      lo[index] = hash.lo;
      hi[index] = hash.hi;
    }

    for (const lambda of lambdas) {
      const bucketCount = Math.max(1, Math.ceil(sortedKeys.length / lambda));
      const buckets: number[][] = Array.from(
        { length: bucketCount },
        () => []
      );

      for (let index = 0; index < sortedKeys.length; index++) {
        buckets[h1[index]! % bucketCount]!.push(index);
      }

      const order = buckets
        .map((bucket, index) => ({ bucket, index }))
        .filter((entry) => entry.bucket.length > 0)
        .sort(
          (left, right) =>
            right.bucket.length - left.bucket.length ||
            left.index - right.index
        );

      for (const multiplier of multipliers) {
        const tableSize = Math.max(
          sortedKeys.length,
          Math.ceil(sortedKeys.length * multiplier)
        );
        const used = new Uint8Array(tableSize);
        const marks = new Uint32Array(tableSize);
        const displacements = new Int32Array(bucketCount);
        const verification = new Uint32Array(tableSize * 2);
        let stamp = 0;
        let failed = false;

        for (const { bucket, index: bucketIndex } of order) {
          let displacement = -1;

          for (let candidate = 0; candidate < tableSize; candidate++) {
            stamp++;
            let valid = true;

            for (const keyIndex of bucket) {
              const slot = (h2[keyIndex]! + candidate) % tableSize;

              if (used[slot] || marks[slot] === stamp) {
                valid = false;
                break;
              }

              marks[slot] = stamp;
            }

            if (!valid) {
              continue;
            }

            displacement = candidate;
            break;
          }

          if (displacement === -1) {
            failed = true;
            break;
          }

          // 0 means "empty bucket", so store displacement + 1.
          displacements[bucketIndex] = displacement + 1;

          for (const keyIndex of bucket) {
            const slot = (h2[keyIndex]! + displacement) % tableSize;

            used[slot] = 1;
            verification[slot * 2] = lo[keyIndex]!;
            verification[slot * 2 + 1] = hi[keyIndex]!;
          }
        }

        if (!failed) {
          return {
            indexKind: "mphf",
            seed,
            bucketCount,
            tableSize,
            displacements,
            verification,
            collisions: collisionEntries(sortedKeys, seed),
          };
        }
      }
    }
  }

  throw new Error(
    `Unable to build a perfect hash for ${keys.length} keys; try the sorted fallback`
  );
};

export const buildSortedHashes = (
  keys: readonly string[],
  seed = DEFAULT_SEED
): SortedArtifact => {
  const hashes = keys
    .map((key) => {
      const hash = hashKey(key, seed);
      return { key, lo: hash.lo, hi: hash.hi };
    })
    .sort(
      (left, right) =>
        left.hi - right.hi ||
        left.lo - right.lo ||
        left.key.localeCompare(right.key)
    );

  const values = new Uint32Array(hashes.length * 2);

  hashes.forEach((hash, index) => {
    values[index * 2] = hash.lo;
    values[index * 2 + 1] = hash.hi;
  });

  return {
    indexKind: "sorted",
    seed,
    tableSize: hashes.length,
    hashes: values,
    collisions: collisionEntries(keys, seed),
  };
};
