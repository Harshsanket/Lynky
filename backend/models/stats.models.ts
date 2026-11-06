import mongoose, { Schema, Document } from "mongoose";

/**
 * Single-document global counter (document key is always `"global"`).
 * Used for the "N links cleaned & shortened" stat on the frontend.
 */
export interface IStats extends Document {
  key: string;
  totalLinks: number;
  totalRedirects: number;
  totalClicksAttempts: number;
  totalClicksSuccess: number;
  totalClicksFailed: number;
}

const statsSchema = new Schema<IStats>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "global",
    },

    totalLinks: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalRedirects: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalClicksAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalClicksSuccess: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalClicksFailed: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const Stats = mongoose.model<IStats>(
  "Stats",
  statsSchema
);
