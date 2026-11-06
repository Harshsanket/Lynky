import mongoose, { Document, Schema } from "mongoose";

/**
 * A shortened link record.
 *
 * - `codeHash` is the HMAC-SHA-256 digest of the short code. The plaintext
 *   code exists only in the creation response; redirects hash the incoming
 *   path and look up this digest.
 * - `originalUrl` stores the AES-256-GCM encrypted, cleaned destination.
 * - `urlHash` is an HMAC-SHA-256 of the cleaned URL, keyed from
 *   `ENCRYPTION_KEY`, used to dedupe identical links without exposing a bare
 *   hash oracle. It is also unique, so the database — not a prior read —
 *   guarantees one record per destination under concurrent writes.
 * - `visitCount` / `lastVisitedAt` are approximate click counters flushed from
 *   Redis pending buckets.
 * - `expiresAt` carries a TTL index so MongoDB auto-deletes expired records.
 */
export interface ILink extends Document {
  codeHash: string;
  /**
   * Legacy plaintext short code. Only pre-`codeHash` rows have this field;
   * the sparse index keeps the fallback lookup cheap without indexing new
   * rows.
   */
  code?: string | null;
  /**
   * Optional per-row recovery salt. New rows always have one; legacy rows
   * created before §15.3.1 may not, and keep the Redis mapping fallback.
   */
  codeSalt?: string | null;
  originalUrl: string;
  urlHash: string;
  visitCount: number;
  lastVisitedAt: Date | null;
  createdAt: Date;
  expiresAt: Date;
}

const linkSchema = new Schema<ILink>(
  {
    code: {
      type: String,
      trim: true,
    },

    codeHash: {
      type: String,
      required: true,
      trim: true,
    },

    codeSalt: {
      type: String,
      default: null,
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
      unique: true,
      index: true,
      trim: true,
    },

    visitCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastVisitedAt: {
      type: Date,
      default: null,
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

/*
 * Legacy rows may predate `codeHash`. Exclude non-string values from the
 * unique index so the index can be built before every legacy row has been
 * backfilled by its first redirect.
 */
linkSchema.index(
  { codeHash: 1 },
  {
    name: "codeHash_1",
    unique: true,
    partialFilterExpression: { codeHash: { $type: "string" } },
  }
);

export const Link = mongoose.model<ILink>("Link", linkSchema);