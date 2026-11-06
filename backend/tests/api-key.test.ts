import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/lynky-test";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.FRONTEND_URL = "https://app.lynky.test";
process.env.EXPIRATION_DAYS = "30";
process.env.API_KEY_LENGTH = "45";

const {
  API_SECRET_ALPHABET,
  generateApiSecret,
  isValidApiSecret,
} = await import("../service/api-key.service.js");
const { env } = await import("../src/config/env.js");

const keyOfLength = (length: number, character = "A"): string =>
  character.repeat(length);

test("generated secrets always validate against the configured length", () => {
  for (let i = 0; i < 20; i++) {
    const secret = generateApiSecret();

    assert.equal(secret.length, env.API_KEY_LENGTH);
    assert.equal(isValidApiSecret(secret), true);

    for (const character of secret) {
      assert.ok(
        API_SECRET_ALPHABET.includes(character),
        `unexpected character ${character}`
      );
    }
  }
});

test("only alphabetic base64url characters at the exact length pass", () => {
  assert.equal(isValidApiSecret(keyOfLength(45)), true);
  assert.equal(
    isValidApiSecret(keyOfLength(45, "Z")),
    true
  );
  assert.equal(
    isValidApiSecret(`${keyOfLength(44)}-`),
    true
  );

  for (const length of [16, 43, 44, 46, 64]) {
    assert.equal(
      isValidApiSecret(keyOfLength(length)),
      false,
      `length ${length} should be rejected`
    );
  }

  for (const invalid of [
    "",
    " AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    `${keyOfLength(44)} `,
    `${keyOfLength(44)}\n`,
    `${keyOfLength(44)}+`,
    `${keyOfLength(44)}/`,
    `${keyOfLength(44)}=`,
    `${keyOfLength(44)}é`,
    null,
    45,
    {},
    [],
    undefined,
  ]) {
    assert.equal(
      isValidApiSecret(invalid),
      false,
      `${JSON.stringify(invalid)} should be rejected`
    );
  }
});

test("the validator follows API_KEY_LENGTH when it changes", () => {
  const previous = env.API_KEY_LENGTH;

  try {
    for (const length of [16, 64]) {
      env.API_KEY_LENGTH = length;

      const secret = generateApiSecret();

      assert.equal(secret.length, length);
      assert.equal(isValidApiSecret(secret), true);
      assert.equal(
        isValidApiSecret(keyOfLength(length - 1)),
        false
      );
      assert.equal(
        isValidApiSecret(keyOfLength(length + 1)),
        false
      );
    }
  } finally {
    env.API_KEY_LENGTH = previous;
  }
});
