import test from 'node:test';
import assert from 'node:assert/strict';

import {
  API_KEY_MAX_INPUT_LENGTH,
  isValidApiKey,
  sanitizeApiKey,
} from './api-key.js';

const keyOfLength = (length) => 'A'.repeat(length);

test('accepts legacy 43-character keys', () => {
  assert.equal(isValidApiKey(keyOfLength(43)), true);
});

test('accepts current 45-character keys', () => {
  assert.equal(isValidApiKey(keyOfLength(45)), true);
});

test('accepts keys configured to other lengths', () => {
  assert.equal(isValidApiKey(keyOfLength(16)), true);
  assert.equal(isValidApiKey(keyOfLength(64)), true);
  assert.equal(isValidApiKey(keyOfLength(128)), true);
});

test('rejects empty input', () => {
  assert.equal(isValidApiKey(''), false);
});

test('rejects non-base64url input', () => {
  assert.equal(isValidApiKey('not a key!'), false);
});

test('sanitizes pasted whitespace and separators', () => {
  assert.equal(sanitizeApiKey('  abc-123_XYZ  '), 'abc-123_XYZ');
  assert.equal(sanitizeApiKey('abc/def+ghi='), 'abcdefghi');
});

test('caps input at the maximum length', () => {
  const oversized = keyOfLength(API_KEY_MAX_INPUT_LENGTH + 50);

  assert.equal(sanitizeApiKey(oversized).length, API_KEY_MAX_INPUT_LENGTH);
  assert.equal(isValidApiKey(oversized), false);
});
