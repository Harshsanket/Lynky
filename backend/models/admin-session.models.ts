import mongoose, { Schema } from "mongoose";

/**
 * Mongo-backed opaque admin session. The cookie contains a random session ID;
 * MongoDB stores only its sha256 digest. Sessions are deliberately not kept in
 * Redis so `/sysadmin` login still works during a Redis outage.
 */
export interface IAdminSession {
  _id: string;
  usernameHash: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  csrfToken: string;
}

const adminSessionSchema = new Schema<IAdminSession>(
  {
    _id: { type: String, required: true },
    usernameHash: { type: String, required: true },
    createdAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
    csrfToken: { type: String, required: true },
  },
  { versionKey: false, timestamps: false }
);

export const AdminSession =
  (mongoose.models.AdminSession as
    | mongoose.Model<IAdminSession>
    | undefined) ??
  mongoose.model<IAdminSession>("AdminSession", adminSessionSchema);
