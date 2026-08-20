import { Stats } from "../models/stats.models.js";

/**
 * Atomically increment the global counter and return the new value.
 * `upsert: true` lazily creates the single "global" document on first use.
 */
export const incrementTotalLinks = async (): Promise<number> => {
  const stats = await Stats.findOneAndUpdate(
    { key: "global" },
    {
      $inc: {
        totalLinks: 1,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
    }
  ).lean();

  return stats?.totalLinks ?? 0;
};

/**
 * Read the current global counter (0 when no links have been shortened yet).
 */
export const getTotalLinks = async (): Promise<number> => {
  const stats = await Stats.findOne({
    key: "global",
  }).lean();

  return stats?.totalLinks ?? 0;
};