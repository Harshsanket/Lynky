import { Stats } from "../models/stats.models.js";

/**
 * Atomically increment the global counter and return the new value.
 * `upsert: true` lazily creates the single "global" document on first use.
 */
const incrementOnce = async () =>
  Stats.findOneAndUpdate(
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

export const incrementTotalLinks = async (): Promise<number> => {
  try {
    const stats = await incrementOnce();

    return stats?.totalLinks ?? 0;
  } catch (error: any) {
    // Two first-ever requests can race on the unique `key` index; retry once
    // now that the document exists.
    if (error?.code === 11000) {
      const stats = await incrementOnce();

      return stats?.totalLinks ?? 0;
    }

    throw error;
  }
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