import test from "node:test";
import assert from "node:assert/strict";

import {
  ADMIN_PASSWORD_HASH_PATTERN,
  createPasswordHash,
  validateAdminPasswordFormat,
  verifyPasswordHash,
} from "../src/utils/admin-password.js";

test("hashes and verifies a sysadmin password", async () => {
  const hash = createPasswordHash("CorrectHorseBattery1!");

  assert.match(hash, ADMIN_PASSWORD_HASH_PATTERN);
  assert.equal(
    await verifyPasswordHash("CorrectHorseBattery1!", hash),
    true
  );
  assert.equal(await verifyPasswordHash("wrong-password", hash), false);
});

test("rejects malformed hashes instead of throwing", async () => {
  assert.equal(await verifyPasswordHash("anything", "nope"), false);
});

test("requires upper, lower, digit, symbol, and length", () => {
  assert.equal(
    validateAdminPasswordFormat("CorrectHorseBattery1!"),
    true
  );

  for (const password of [
    "short1!",
    "alllowercase1!",
    "ALLUPPERCASE1!",
    "NoDigitsHere!",
    "NoSymbolsHere1",
  ]) {
    assert.equal(
      validateAdminPasswordFormat(password),
      false,
      password
    );
  }
});
