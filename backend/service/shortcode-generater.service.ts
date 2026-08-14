import crypto from "node:crypto";

const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const generateCode = (
  urlHash: string,
  attempt: number,
  CODE_LENGTH: number
): string => {
  const digest = crypto
    .createHash("sha256")
    .update(`${urlHash}:${attempt}`)
    .digest();

  let number = digest.readUIntBE(0, 6);

  let code = "";

  for (let i = 0; i < CODE_LENGTH; i++) {
    code += BASE62[number % BASE62.length];

    number = Math.floor(
      number / BASE62.length
    );
  }

  return code;
};