import { connectDatabase } from "../database/index.database.js";
import { Link, type ILink } from "../models/link.models.js";
import { hashCode } from "./code-hash.service.js";

export type RedirectLink = Pick<
  ILink,
  "originalUrl" | "expiresAt" | "visitCount" | "lastVisitedAt"
> & { _id: unknown; codeHash: string };

/**
 * Resolve a redirect by hashing the path code. Before the migration has run,
 * legacy rows still have a plaintext `code`; reading one backfills `codeHash`
 * and removes the legacy field so the next request uses the hash path only.
 */
export const findLinkForRedirect = async (
  code: string
): Promise<RedirectLink | null> => {
  await connectDatabase();

  const codeHash = hashCode(code);
  const now = new Date();

  const current = await Link.findOne({
    codeHash,
    expiresAt: { $gt: now },
  }).lean();

  if (current) {
    return current as unknown as RedirectLink;
  }

  const legacy = await Link.collection.findOne({
    code,
    expiresAt: { $gt: now },
  });

  if (!legacy) {
    return null;
  }

  const legacyCode = String((legacy as { code?: unknown }).code ?? "");

  if (!legacyCode) {
    return null;
  }

  const legacyHash = hashCode(legacyCode);

  await Link.collection.updateOne(
    { _id: legacy._id },
    {
      $set: { codeHash: legacyHash },
      $unset: { code: "" },
    }
  );

  return {
    _id: legacy._id,
    codeHash: legacyHash,
    originalUrl: String(legacy.originalUrl ?? ""),
    expiresAt: new Date(legacy.expiresAt as Date),
    visitCount: Number(legacy.visitCount ?? 0),
    lastVisitedAt: (legacy.lastVisitedAt as Date | null) ?? null,
  };
};
