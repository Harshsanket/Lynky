import { Link } from "../models/link.models.js";
import { logInfo } from "./logger.js";

/**
 * Ensure the links collection has the indexes the runtime expects.
 *
 * The legacy plaintext `code` index must be sparse: MongoDB treats a missing
 * field as null in a non-sparse unique index, so new codeHash-only rows would
 * collide with each other and every create would fail. Production may carry
 * this index under an older name, so detect it by key rather than by name.
 */
export const assertLinkIndexesReady = async (): Promise<void> => {
  await Link.init();

  const indexes = await Link.collection.indexes();
  const codeIndexes = indexes.filter(
    (index) =>
      index.key &&
      (index.key as Record<string, unknown>).code === 1
  );
  const canonical = codeIndexes.find(
    (index) => index.name === "code_1"
  );
  const needsRepair =
    codeIndexes.length > 0 &&
    (codeIndexes.length !== 1 ||
      canonical === undefined ||
      canonical.sparse !== true);

  if (needsRepair) {
    for (const index of codeIndexes) {
      if (!index.name) {
        continue;
      }

      try {
        await Link.collection.dropIndex(index.name);
      } catch (error) {
        if ((error as { codeName?: string }).codeName !== "IndexNotFound") {
          throw error;
        }
      }
    }

    await Link.collection.createIndex(
      { code: 1 },
      { name: "code_1", sparse: true }
    );

    logInfo("legacy_code_index_repaired", {
      dropped: codeIndexes
        .map((index) => index.name)
        .filter((name): name is string => typeof name === "string"),
      created: "code_1",
    });
  } else if (codeIndexes.length === 0) {
    await Link.collection.createIndex(
      { code: 1 },
      { name: "code_1", sparse: true }
    );
  }

  const codeHashIndex = indexes.find(
    (index) => index.name === "codeHash_1"
  );

  if (!codeHashIndex || codeHashIndex.unique !== true) {
    throw new Error(
      "codeHash_1 unique index is missing. Create it before starting this version."
    );
  }
};
