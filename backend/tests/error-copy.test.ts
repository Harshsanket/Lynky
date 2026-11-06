import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/lynky-test";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";
process.env.GLOBAL_RATE_LIMIT_PER_HOUR = "1000";

const { default: app } = await import("../src/app.js");
const { LINK_TOO_LARGE_MESSAGE } = await import(
  "../service/public-error.service.js"
);

test("the body-size guard returns the shared Link too large copy", async () => {
  const server = app.listen(0);

  await new Promise<void>((resolve) => {
    server.once("listening", () => resolve());
  });

  const address = server.address();

  assert.ok(address && typeof address === "object");

  const base = `http://127.0.0.1:${address.port}`;

  try {
    const response = await fetch(`${base}/api/v1/urls`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "a".repeat(20_000) }),
    });

    assert.equal(response.status, 413);

    const body = (await response.json()) as {
      success?: boolean;
      message?: string;
    };

    assert.equal(body.success, false);
    assert.equal(body.message, LINK_TOO_LARGE_MESSAGE);
    assert.equal(body.message, "Link too large");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
});
