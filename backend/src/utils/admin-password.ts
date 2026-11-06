import crypto from "node:crypto";

export const ADMIN_PASSWORD_HASH_PATTERN =
  /^scrypt:([a-f0-9]{32}):([a-f0-9]{128})$/i;

export const validateAdminPasswordFormat = (password: unknown): boolean => {
  if (typeof password !== "string") {
    return false;
  }

  return (
    password.length >= 12 &&
    password.length <= 128 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
};

export const createPasswordHash = (password: string): string => {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
  });

  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
};

export const verifyPasswordHash = async (
  password: string,
  encoded: string
): Promise<boolean> => {
  const match = encoded.match(ADMIN_PASSWORD_HASH_PATTERN);

  if (!match) {
    return false;
  }

  const salt = Buffer.from(match[1]!, "hex");
  const expected = Buffer.from(match[2]!, "hex");

  const actual = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      expected.byteLength,
      { N: 16384, r: 8, p: 1 },
      (error, derived) => {
        if (error) {
          reject(error);
        } else {
          resolve(derived);
        }
      }
    );
  });

  return (
    actual.byteLength === expected.byteLength &&
    crypto.timingSafeEqual(actual, expected)
  );
};
