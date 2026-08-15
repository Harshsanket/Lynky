import { Stats } from "../models/stats.models.js";

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

export const getTotalLinks = async (): Promise<number> => {
  const stats = await Stats.findOne({
    key: "global",
  }).lean();

  return stats?.totalLinks ?? 0;
};