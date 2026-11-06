import { Link } from "../models/link.models.js";

/**
 * Refuse to serve create traffic while the legacy plaintext `code_1` unique
 * index is still present. MongoDB treats missing fields as null in a
 * non-sparse unique index, so new codeHash-only rows would otherwise collide
 * with each other and every create would fail.
 */
export const assertLinkIndexesReady = async (): Promise<void> => {
  await Link.init();

  const indexes = await Link.collection.indexes();
  const legacyCodeIndex = indexes.find((index) => index.name === "code_1");

  if (legacyCodeIndex && legacyCodeIndex.sparse !== true) {
    throw new Error(
      "Legacy code_1 unique index is not sparse. Drop it during a maintenance window before starting this version."
    );
  }

  if (!legacyCodeIndex) {
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
