import "dotenv/config";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { connectDatabase } from "../database/index.database.js";
import { Link } from "../models/link.models.js";

/**
 * CLI script: `npm run migrate:urlhash`.
 *
 * Backs the new dedupe guarantee (unique `urlHash` index):
 *
 *  1. Finds every `urlHash` shared by more than one record — leftovers from
 *     the old check-then-insert race.
 *  2. Keeps one record per hash (a live one if any exists, otherwise the
 *     oldest) and rewrites each duplicate's `urlHash` to a derived value so
 *     the short codes those duplicates already handed out keep working.
 *     Scrambled rows are excluded from dedupe lookups by construction,
 *     because those lookups always use the clean hash.
 *  3. Builds the unique index explicitly.
 *
 * Safe to re-run: it is a no-op once the collection is clean and the index
 * exists.
 */
const scrambleHash = (urlHash: string, code: string): string =>
  crypto
    .createHash("sha256")
    .update(`${urlHash}:${code}`)
    .digest("hex");

const run = async () => {
  try {
    await connectDatabase();

    /* ---------------------------------------------------------------- */
    /* 1. Locate duplicate urlHash groups                                */
    /* ---------------------------------------------------------------- */

    const groups = await Link.aggregate<{ _id: string; ids: mongoose.Types.ObjectId[] }>([
      { $group: { _id: "$urlHash", ids: { $push: "$_id" } } },
      { $match: { _id: { $ne: null }, $expr: { $gt: [{ $size: "$ids" }, 1] } } },
    ]);

    console.log(`\nFound ${groups.length} urlHash group(s) with duplicates.`);

    /* ---------------------------------------------------------------- */
    /* 2. Keep one record per hash, scramble the rest                    */
    /* ---------------------------------------------------------------- */

    let scrambled = 0;
    const affectedCodes: string[] = [];

    for (const group of groups) {
      const rows = await Link.find({ _id: { $in: group.ids } })
        .select({ code: 1, expiresAt: 1, createdAt: 1 })
        .lean();

      const now = new Date();

      // Prefer a live record; tie-break on the oldest so behaviour is
      // deterministic across runs.
      const [keeper, ...duplicates] = rows.sort((a, b) => {
        const aLive = a.expiresAt > now ? 0 : 1;
        const bLive = b.expiresAt > now ? 0 : 1;

        if (aLive !== bLive) return aLive - bLive;

        return (
          new Date(a.createdAt ?? 0).getTime() -
          new Date(b.createdAt ?? 0).getTime()
        );
      });

      if (!keeper || duplicates.length === 0) continue;

      for (const duplicate of duplicates) {
        await Link.updateOne(
          { _id: duplicate._id },
          { $set: { urlHash: scrambleHash(group._id, duplicate.code) } }
        );

        affectedCodes.push(duplicate.code);
        scrambled++;
      }

      console.log(
        `  kept ${keeper.code} for ${group._id.slice(0, 12)}… ; scrambled ${duplicates.length}`
      );
    }

    if (affectedCodes.length > 0) {
      console.log(
        `\nRewrote ${scrambled} duplicate row(s). Their short codes still work:`
      );
      affectedCodes.forEach((code, index) => {
        console.log(`  ${index + 1}. ${code}`);
      });
    }

    /* ---------------------------------------------------------------- */
    /* 3. Build the unique index                                        */
    /* ---------------------------------------------------------------- */

    // A non-unique `urlHash_1` may already exist from the old schema, and
    // MongoDB cannot change an index's options in place — drop it first.
    const existing = (await Link.collection.indexes()).find(
      (index) => index.name === "urlHash_1"
    );

    if (existing) {
      if (existing.unique) {
        console.log("\nUnique index urlHash_1 already in place.");
        console.log("Migration complete.\n");
        return;
      }

      console.log(
        "\nDropping non-unique urlHash_1 before rebuilding…"
      );

      await Link.collection.dropIndex("urlHash_1");
    }

    const indexName = await Link.collection.createIndex(
      { urlHash: 1 },
      { unique: true, name: "urlHash_1" }
    );

    console.log(`\nUnique index ready: ${indexName}`);
    console.log("Migration complete.\n");
  } catch (error) {
    console.error("Migration failed:", error);

    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
