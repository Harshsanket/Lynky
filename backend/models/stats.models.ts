import mongoose, { Schema, Document } from "mongoose";

export interface IStats extends Document {
  key: string;
  totalLinks: number;
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
  },
  {
    timestamps: true,
  }
);

export const Stats = mongoose.model<IStats>(
  "Stats",
  statsSchema
);
