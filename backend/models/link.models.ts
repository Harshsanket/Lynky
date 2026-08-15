import mongoose, { Document, Schema } from "mongoose";

export interface ILink extends Document {
  code: string;
  originalUrl: string;
  urlHash: string;
  createdAt: Date;
  expiresAt: Date;
}

const linkSchema = new Schema<ILink>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    originalUrl: {
      type: String,
      required: true,
      trim: true,
    },

    urlHash: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: {
        expires: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

export const Link = mongoose.model<ILink>("Link", linkSchema);