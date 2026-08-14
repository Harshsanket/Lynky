import crypto from "node:crypto";

export const hashUrl = (
  url: string
): string => {
  return crypto
    .createHash("sha256")
    .update(url)
    .digest("hex");
};