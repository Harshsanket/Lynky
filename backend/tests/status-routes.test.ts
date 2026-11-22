import test, { after } from "node:test";
import assert from "node:assert/strict";

const baseMongoUri = process.env.TEST_MONGODB_URI;
const testMongoUri = baseMongoUri
  ? baseMongoUri.replace(
      /\/[^/?]+(\?.*)?$/,
      "/lynky-status-routes$1"
    )
  : undefined;

process.env.NODE_ENV = "test";
process.env.MONGODB_URI =
  testMongoUri ?? "mongodb://127.0.0.1:1/lynky-integration-skipped";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";

const run = testMongoUri ? test : test.skip;
const mongoose = (await import("mongoose")).default;

after(async () => {
  await mongoose.disconnect();
});

run("POST /api/v1/status returns the same body as GET", async () => {
  const { default: app } = await import("../src/app.js");
  const server = app.listen(0);

  await new Promise<void>((resolve) => {
    server.once("listening", () => resolve());
  });

  const address = server.address();

  assert.ok(address && typeof address === "object");

  const base = `http://127.0.0.1:${address.port}`;

  try {
    const getResponse = await fetch(`${base}/api/v1/status`);
    const postResponse = await fetch(`${base}/api/v1/status`, {
      method: "POST",
    });

    assert.equal(getResponse.status, 200);
    assert.equal(postResponse.status, 200);
    assert.deepEqual(
      await postResponse.json(),
      await getResponse.json()
    );
    assert.equal(
      postResponse.headers.get("cache-control"),
      getResponse.headers.get("cache-control")
    );
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
});
