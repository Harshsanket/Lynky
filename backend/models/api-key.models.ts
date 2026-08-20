import mongoose, { Schema, Document } from "mongoose";

/**
 * Current usage period key, e.g. `2026-08` (UTC). Used to detect month
 * rollovers so counters reset automatically at the start of each month.
 */
export const getUsageMonth = (
  date: Date = new Date()
): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(
    2,
    "0"
  );

  return `${year}-${month}`;
};

/** How many months of usage history are retained (rolling window). */
export const MAX_USAGE_HISTORY_MONTHS = 12;

export interface IUsageHistoryEntry {
  month: string;
  count: number;
}

/**
 * An issued API key.
 *
 * The raw secret is never stored; only its sha256 hash (`keyHash`). Usage is
 * tracked for the current month (`monthlyUsageCount` / `usageMonth`) plus a
 * capped rolling `usageHistory` for reporting.
 */
export interface IApiKey extends Document {
  _id: mongoose.Types.ObjectId;
  keyHash: string;
  status: "active" | "disabled";
  monthlyUsageCount: number;
  usageMonth: string;
  usageHistory: IUsageHistoryEntry[];
  owner: mongoose.Types.ObjectId | null;
  lastUsedAt: Date | null;
}

const apiKeySchema = new Schema<IApiKey>(
  {
    keyHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
      index: true,
    },

    monthlyUsageCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    usageMonth: {
      type: String,
      required: true,
      default: () => getUsageMonth(),
    },

    usageHistory: {
      type: [
        {
          month: { type: String, required: true },
          count: {
            type: Number,
            default: 0,
            min: 0,
          },
        },
      ],
      default: [],
    },

    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    lastUsedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const ApiKey = mongoose.model<IApiKey>(
  "ApiKey",
  apiKeySchema
);
