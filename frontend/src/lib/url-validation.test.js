import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_URL_LENGTH,
  validateUrlInput,
  MESSAGES,
} from './url-validation.js';

/**
 * Fixture classes mirror `backend/tests/url-validator.test.ts` so the two
 * implementations cannot drift. The frontend asserts verdict + message class;
 * the backend remains the security boundary.
 */

const validCases = [
  'https://example.net/path',
  'http://sub.example.co.uk/x?q=1',
  'http://9.9.9.9/',
  'https://example.net/',
];

const rejectedCases = [
  ['', MESSAGES.invalid],
  ['   ', MESSAGES.invalid],
  ['not a url', MESSAGES.invalid],
  ['ftp://example.net/', MESSAGES.invalid],
  ['data:text/html,hi', MESSAGES.invalid],
  ['//example.net/x', MESSAGES.invalid],

  ['https://exa\u0000mple.net/', MESSAGES.invalid],
  ['https://exa\u007Fmple.net/', MESSAGES.invalid],
  ['https://exa\u0085mple.net/', MESSAGES.invalid],
  ['https://exa\u202Emple.net/', MESSAGES.invalid],
  ['ht\ttps://example.net/', MESSAGES.invalid],
  ['https://example.net/\nx', MESSAGES.invalid],

  ['https:\\\\example.net', MESSAGES.invalid],

  ['http://user:pass@example.net/', MESSAGES.credentials],
  ['http://user@example.net/', MESSAGES.credentials],
  ['http://:pass@example.net/', MESSAGES.credentials],
  ['http://@example.net/', MESSAGES.credentials],

  ['http://my_server.net/', MESSAGES.invalid],
  ['http://-bad.net/', MESSAGES.invalid],
  ['http://bad-.net/', MESSAGES.invalid],
  ['http://a..b.net/', MESSAGES.invalid],
  ['http://xn--fsq.net/', MESSAGES.idn],
  ['https://\u4F8B\u3048.jp/', MESSAGES.idn],

  ['http://localhost/', MESSAGES.privateNetwork],
  ['http://sub.localhost/', MESSAGES.privateNetwork],
  ['http://localhost:8080/', MESSAGES.privateNetwork],
  ['http://127.0.0.1/', MESSAGES.privateNetwork],
  ['http://127.0.1.2/', MESSAGES.privateNetwork],
  ['http://[::1]/', MESSAGES.privateNetwork],
  ['http://0.0.0.0/', MESSAGES.privateNetwork],
  ['http://[::ffff:127.0.0.1]/', MESSAGES.privateNetwork],
  ['http://[::ffff:10.0.0.1]/', MESSAGES.privateNetwork],

  ['http://2130706433/', MESSAGES.privateNetwork],
  ['http://0x7f.0.0.1/', MESSAGES.privateNetwork],
  ['http://0177.0.0.001/', MESSAGES.privateNetwork],
  ['http://0x7f000001/', MESSAGES.privateNetwork],

  ['http://10.1.2.3/', MESSAGES.privateNetwork],
  ['http://172.16.0.5/', MESSAGES.privateNetwork],
  ['http://192.168.1.1/', MESSAGES.privateNetwork],
  ['http://100.64.0.1/', MESSAGES.privateNetwork],
  ['http://169.254.169.254/', MESSAGES.privateNetwork],
  ['http://192.0.2.11/', MESSAGES.privateNetwork],
  ['http://192.88.99.1/', MESSAGES.privateNetwork],
  ['http://198.18.0.3/', MESSAGES.privateNetwork],
  ['http://198.51.100.7/', MESSAGES.privateNetwork],
  ['http://203.0.113.9/', MESSAGES.privateNetwork],
  ['http://224.0.0.1/', MESSAGES.privateNetwork],
  ['http://240.0.0.1/', MESSAGES.privateNetwork],
  ['http://255.255.255.255/', MESSAGES.privateNetwork],

  ['http://[::]/', MESSAGES.privateNetwork],
  ['http://[::7f00:1]/', MESSAGES.privateNetwork],
  ['http://[::c0a8:101]/', MESSAGES.privateNetwork],
  ['http://[::a00:1]/', MESSAGES.privateNetwork],
  ['http://[fc00::1]/', MESSAGES.privateNetwork],
  ['http://[fe80::1]/', MESSAGES.privateNetwork],
  ['http://[ff02::1]/', MESSAGES.privateNetwork],
  ['http://[2001:db8::1]/', MESSAGES.privateNetwork],
  ['http://[2002:a00:1::]/', MESSAGES.privateNetwork],
  [
    'http://[2001:0000:4136:e378:8000:63bf:3fff:fdd2]/',
    MESSAGES.privateNetwork,
  ],

  ['http://foo.local/', MESSAGES.internal],
  ['http://service.internal/', MESSAGES.internal],
  ['http://db.lan/', MESSAGES.internal],
  ['http://app.home.arpa/', MESSAGES.internal],
  ['http://unit.test/', MESSAGES.internal],
  ['http://unit.example/', MESSAGES.internal],
  ['http://foo.invalid/', MESSAGES.internal],

  ['http://myserver/', MESSAGES.invalid],

  // IPv6 zone / leftover percent-escapes in host
  ['http://[fe80::1%25eth0]/', MESSAGES.invalid],

  // `myserver.corp`-style hosts (real label, unknown/no public suffix) are
  // detected server-side by tldts (`isIcann`); the browser bundle ships no
  // suffix data, so this class intentionally has no frontend fixture.
];

test('accepts public internet URLs', () => {
  for (const input of validCases) {
    const check = validateUrlInput(input);

    assert.equal(check.valid, true, `${input} should be accepted`);
  }
});

test('rejects the whole matrix with the mirrored messages', () => {
  for (const [input, expectedMessage] of rejectedCases) {
    const check = validateUrlInput(input);

    assert.equal(
      check.valid,
      false,
      `${JSON.stringify(input)} should be rejected`
    );
    assert.equal(
      check.message,
      expectedMessage,
      `${JSON.stringify(input)} should produce the mirrored message`
    );
  }
});

test('returns the parsed URL on success', () => {
  const check = validateUrlInput('https://example.net/path?q=1');

  assert.equal(check.valid, true);
  assert.equal(check.url.hostname, 'example.net');
});

test('enforces the maximum URL length before the API call', () => {
  const longUrl = `https://example.net/?pad=${'a'.repeat(MAX_URL_LENGTH)}`;
  const check = validateUrlInput(longUrl);

  assert.equal(check.valid, false);
  assert.match(
    check.message,
    new RegExp(`maximum length of ${MAX_URL_LENGTH} characters`),
  );
});
