import { Link } from "../models/link.models.js";
import { logInfo } from "./logger.js";

const CODE_HASH_INDEX = {
  name: "codeHash_1",
  unique: true,
  partialFilterExpression: { codeHash: { $type: "string" } },
} as const;

const codeHashIsPartialUnique = (index: {
  unique?: boolean;
  partialFilterExpression?: Record<string, unknown>;
}): boolean => {
  const filter = index.partialFilterExpression;
  const codeHash = filter?.codeHash as { $type?: unknown } | undefined;

  return index.unique === true && codeHash?.$type === "string";
};

/**
 * Ensure the links collection has the indexes the runtime expects.
 *
 * Production can carry indexes from older schemas: a non-sparse plaintext
 * `code` index, a non-unique `urlHash_1`, or a non-partial `codeHash_1`.
 * Repair them by key before Mongoose's `Link.init()` attempts to create its
 * own definitions and fails with an index conflict.
 */
export const assertLinkIndexesReady = async (): Promise<void> => {
  const indexes = await Link.collection.indexes();
  const dropped: string[] = [];

  /* Legacy plaintext code index: must be sparse so codeHash-only rows are
     not treated as duplicate nulls. */
  const codeIndexes = indexes.filter(
    (index) =>
      index.key &&
      (index.key as Record<string, unknown>).code === 1
  );
  const canonicalCode = codeIndexes.find(
    (index) => index.name === "code_1"
  );
  const codeNeedsRepair =
    codeIndexes.length > 0 &&
    (codeIndexes.length !== 1 ||
      canonicalCode === undefined ||
      canonicalCode.sparse !== true);

  if (codeNeedsRepair) {
    for (const index of codeIndexes) {
      if (!index.name) continue;

      try {
        await Link.collection.dropIndex(index.name);
        dropped.push(index.name);
      } catch (error) {
        if ((error as { codeName?: string }).codeName !== "IndexNotFound") {
          throw error;
        }
      }
    }
  }

  if (codeIndexes.length === 0 || codeNeedsRepair) {
    await Link.collection.createIndex(
      { code: 1 },
      { name: "code_1", sparse: true }
    );
  }

  /* Legacy urlHash index: must be unique. */
  const urlHashIndex = indexes.find(
    (index) =>
      index.key &&
      (index.key as Record<string, unknown>).urlHash === 1
  );

  if (urlHashIndex?.name && urlHashIndex.unique !== true) {
    await Link.collection.dropIndex(urlHashIndex.name);
    dropped.push(urlHashIndex.name);
    await Link.collection.createIndex(
      { urlHash: 1 },
      { name: "urlHash_1", unique: true }
    );
  }

  if (!urlHashIndex) {
    await Link.collection.createIndex(
      { urlHash: 1 },
      { name: "urlHash_1", unique: true }
    );
  }

  /* Legacy codeHash index: must be unique for string values only, so rows
     created before codeHash existed do not block the index build. */
  const codeHashIndexes = indexes.filter(
    (index) =>
      index.key &&
      (index.key as Record<string, unknown>).codeHash === 1
  );
  const canonicalCodeHash = codeHashIndexes.find(
    (index) => index.name === "codeHash_1"
  );
  const hasPartialCodeHash = codeHashIndexes.some(codeHashIsPartialUnique);

  if (!hasPartialCodeHash) {
    if (canonicalCodeHash?.name) {
      await Link.collection.dropIndex(canonicalCodeHash.name);
      dropped.push(canonicalCodeHash.name);
    }

    await Link.collection.createIndex(
      { codeHash: 1 },
      CODE_HASH_INDEX
    );
  }

  if (dropped.length > 0) {
    logInfo("link_indexes_repaired", { dropped });
  }

  /* Let Mongoose create any remaining schema indexes, then verify the
     critical unique indexes exist. */
  await Link.init();

  const finalIndexes = await Link.collection.indexes();
  const codeHashIndex = finalIndexes.find(
    (index) => index.name === "codeHash_1"
  );
  const urlHashIndexFinal = finalIndexes.find(
    (index) => index.name === "urlHash_1"
  );

  if (!codeHashIndex || codeHashIndex.unique !== true) {
    throw new Error(
      "codeHash_1 unique index is missing. Create it before starting this version."
    );
  }

  if (!urlHashIndexFinal || urlHashIndexFinal.unique !== true) {
    throw new Error(
      "urlHash_1 unique index is missing. Create it before starting this version."
    );
  }
};

let indexesReady: Promise<void> | null = null;

/**
 * Run the index check once per process. Vercel's Express entrypoint does not
 * execute `server.ts`, so the database middleware calls this before routes.
 */
export const ensureLinkIndexesReady = (): Promise<void> => {
  indexesReady ??= assertLinkIndexesReady().catch((error) => {
    indexesReady = null;
    throw error;
  });

  return indexesReady;
};
