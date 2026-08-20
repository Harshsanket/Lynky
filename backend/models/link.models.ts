import mongoose, { Document, Schema } from "mongoose";

/**
 * A shortened link record.
 *
 * - `code` is the unique short identifier (`/code` redirects to destination).
 * - `originalUrl` stores the AES-256-GCM encrypted, cleaned destination.
 * - `urlHash` is a sha256 of the cleaned URL, used to dedupe identical links.
 * - `expiresAt` carries a TTL index so MongoDB auto-deletes expired records.
 */
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