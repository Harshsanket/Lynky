import test from 'node:test';
import assert from 'node:assert/strict';

import {
  API_KEY_LENGTH,
  isValidApiKey,
  isValidApiKeyForLength,
  sanitizeApiKey,
} from './api-key.js';

const keyOfLength = (length, character = 'A') =>
  character.repeat(length);

test('defaults to the backend 45-character length', () => {
  assert.equal(API_KEY_LENGTH, 45);
  assert.equal(isValidApiKey(keyOfLength(45)), true);
});

test('accepts every configured length the backend permits', () => {
  for (const length of [16, 45, 64]) {
    assert.equal(
      isValidApiKeyForLength(keyOfLength(length), length),
      true,
      `length ${length} should be accepted`,
    );
  }
});

test('requires the exact configured length', () => {
  for (const length of [16, 43, 44, 46, 64]) {
    assert.equal(
      isValidApiKey(keyOfLength(length)),
      false,
      `length ${length} should be rejected`,
    );
  }
});

test('only accepts base64url generator characters', () => {
  const key = keyOfLength(API_KEY_LENGTH);

  assert.equal(isValidApiKey(key), true);
  assert.equal(
    isValidApiKey(`${keyOfLength(API_KEY_LENGTH - 1)}-`),
    true,
  );

  for (const invalid of [
    '',
    ` ${keyOfLength(API_KEY_LENGTH - 1)}`,
    `${keyOfLength(API_KEY_LENGTH - 1)} `,
    `${keyOfLength(API_KEY_LENGTH - 1)}+`,
    `${keyOfLength(API_KEY_LENGTH - 1)}/`,
    `${keyOfLength(API_KEY_LENGTH - 1)}=`,
    `${keyOfLength(API_KEY_LENGTH - 1)}é`,
    null,
    45,
    {},
    [],
    undefined,
  ]) {
    assert.equal(
      isValidApiKey(invalid),
      false,
      `${JSON.stringify(invalid)} should be rejected`,
    );
  }
});

test('sanitizes only outer whitespace and caps the input', () => {
  assert.equal(sanitizeApiKey('  abc-123_XYZ  '), 'abc-123_XYZ');
  assert.equal(sanitizeApiKey('abc/def+ghi='), 'abc/def+ghi=');

  const oversized = keyOfLength(API_KEY_LENGTH + 50);

  assert.equal(sanitizeApiKey(oversized).length, API_KEY_LENGTH);
  assert.equal(isValidApiKey(oversized), false);
});
