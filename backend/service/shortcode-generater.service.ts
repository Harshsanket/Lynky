import crypto from "node:crypto";
import { env } from "../src/config/env.js";

const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Random code length within the configured [MIN, MAX] range.
 */
export const getCodeLength = (): number => {
  const min = env.MIN_CODE_LENGTH;
  const max = env.MAX_CODE_LENGTH;

  const range = max - min + 1;

  return min + Math.floor(Math.random() * range);
};

export const generateCode = (
  urlHash: string,
  attempt: number,
  codeLength: number
): string => {
  const digest = crypto
    .createHash("sha256")
    .update(`${urlHash}:${attempt}`)
    .digest();

  let number = digest.readUIntBE(0, 6);

  let code = "";

  for (let i = 0; i < codeLength; i++) {
    code += BASE62[number % BASE62.length];

    number = Math.floor(
      number / BASE62.length
    );
  }

  return code;
};