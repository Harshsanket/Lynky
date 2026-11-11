import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/lynky-test";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";

const {
  csrfTokenMatches,
  sameSiteForDeployment,
  sessionCookieOptions,
  clearSessionCookieOptions,
} = await import("../service/admin-auth.service.js");

const config = (
  isProduction: boolean,
  publicUrl: string,
  frontendUrl: string | undefined
) => ({
  isProduction,
  PUBLIC_URL: publicUrl,
  FRONTEND_URL: frontendUrl,
});

test("development keeps SameSite=Strict even when origins differ", () => {
  assert.equal(
    sameSiteForDeployment(
      config(false, "http://localhost:5080", "http://localhost:5173")
    ),
    "strict"
  );
});

test("production same-origin keeps SameSite=Strict", () => {
  assert.equal(
    sameSiteForDeployment(
      config(true, "https://lynky.example", "https://lynky.example")
    ),
    "strict"
  );
});

test("production split-origin uses SameSite=None", () => {
  assert.equal(
    sameSiteForDeployment(
      config(
        true,
        "https://short-lynky.example",
        "https://lynky.example"
      )
    ),
    "none"
  );
});

test("invalid production origins fail closed to SameSite=None", () => {
  assert.equal(
    sameSiteForDeployment(config(true, "not a url", "also not a url")),
    "none"
  );
});

test("CSRF tokens compare only on an exact, non-empty match", () => {
  const token = "a".repeat(43);

  assert.equal(csrfTokenMatches(token, token), true);
  assert.equal(csrfTokenMatches(`${token}b`, token), false);
  assert.equal(csrfTokenMatches(undefined, token), false);
  assert.equal(csrfTokenMatches(token, undefined), false);
});

test("development cookie builders keep Strict and non-secure", () => {
  for (const options of [
    sessionCookieOptions(),
    clearSessionCookieOptions(),
  ]) {
    assert.equal(options.sameSite, "strict");
    assert.equal(options.secure, false);
    assert.equal(options.httpOnly, true);
    assert.equal(options.path, "/");
  }
});
