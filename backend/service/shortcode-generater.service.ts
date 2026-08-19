import crypto from "node:crypto";

const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const getCodeLength = (): number => {
  const min = Number(process.env.MIN_CODE_LENGTH) || 4;
  const max = Number(process.env.MAX_CODE_LENGTH) || 6;

  if (
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    min < 1 ||
    max < min
  ) {
    throw new Error(
      "MIN_CODE_LENGTH / MAX_CODE_LENGTH are not configured correctly"
    );
  }

  const range = max - min + 1;

  return min + Math.floor(Math.random() * range);
};

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