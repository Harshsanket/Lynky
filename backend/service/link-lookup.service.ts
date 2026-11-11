import { connectDatabase } from "../database/index.database.js";
import { Link, type ILink } from "../models/link.models.js";
import { hashCode } from "./code-hash.service.js";

export type RedirectLink = Pick<
  ILink,
  "originalUrl" | "expiresAt" | "visitCount" | "lastVisitedAt"
> & { _id: unknown; codeHash: string };

/**
 * Resolve a redirect by hashing the path code.
 *
 * The legacy plaintext-code fallback was removed after production reached
 * zero rows without `codeHash`; keeping it would require a `code_1` index on
 * every insert and a collection scan for every cache-miss 404.
 */
export const findLinkForRedirect = async (
  code: string
): Promise<RedirectLink | null> => {
  await connectDatabase();

  const current = await Link.findOne({
    codeHash: hashCode(code),
    expiresAt: { $gt: new Date() },
  }).lean();

  return (current as unknown as RedirectLink | null) ?? null;
};
