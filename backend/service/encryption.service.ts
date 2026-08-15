import crypto from "node:crypto";

const getKeys = () => {
  const secret = process.env.ENCRYPTION_KEY;

  if (!secret) {
    throw new Error(
      "ENCRYPTION_KEY is not configured"
    );
  }

  const aesKey = crypto
    .createHash("sha256")
    .update(`${secret}:aes`)
    .digest();

  const hmacKey = crypto
    .createHash("sha256")
    .update(`${secret}:hmac`)
    .digest();

  return { aesKey, hmacKey };
};

export const encryptUrl = (
  value: string
): string => {
  const { aesKey, hmacKey } = getKeys();

  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    aesKey,
    iv
  );

  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  const payload = Buffer.concat([
    iv,
    authTag,
    ciphertext,
  ]);

  const mac = crypto
    .createHmac("sha256", hmacKey)
    .update(payload)
    .digest();

  return Buffer.concat([payload, mac]).toString(
    "base64url"
  );
};

export const decryptUrl = (
  payload: string
): string => {
  const { aesKey, hmacKey } = getKeys();

  const buffer = Buffer.from(payload, "base64url");

  const macLength = 32;

  const mac = buffer.subarray(
    buffer.length - macLength
  );

  const data = buffer.subarray(
    0,
    buffer.length - macLength
  );

  const expectedMac = crypto
    .createHmac("sha256", hmacKey)
    .update(data)
    .digest();

  if (
    !crypto.timingSafeEqual(mac, expectedMac)
  ) {
    throw new Error(
      "Encrypted value failed HMAC verification"
    );
  }

  const iv = data.subarray(0, 12);

  const authTag = data.subarray(12, 28);

  const ciphertext = data.subarray(28);

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    aesKey,
    iv
  );

  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
};
