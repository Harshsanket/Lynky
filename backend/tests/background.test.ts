import test from "node:test";
import assert from "node:assert/strict";

const {
  runInBackground,
  flushBackgroundTasksForTests,
  backgroundTaskCountForTests,
} = await import("../src/utils/background.js");

test("runs a background task without blocking the caller", async () => {
  let completed = false;

  runInBackground(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    completed = true;
  }, { event: "background_test" });

  assert.equal(completed, false);
  assert.ok(backgroundTaskCountForTests() >= 1);

  await flushBackgroundTasksForTests();

  assert.equal(completed, true);
  assert.equal(backgroundTaskCountForTests(), 0);
});

test("retries a failing background task with a bounded attempt count", async () => {
  let attempts = 0;

  runInBackground(async () => {
    attempts++;

    if (attempts < 3) {
      throw new Error("transient");
    }
  }, {
    event: "background_test",
    maxAttempts: 3,
    retryDelayMs: 1,
  });

  await flushBackgroundTasksForTests();

  assert.equal(attempts, 3);
});

test("logs a structured final failure and never throws", async () => {
  const original = console.error;
  const lines: string[] = [];

  console.error = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };

  try {
    runInBackground(
      () => {
        throw new Error("permanent");
      },
      {
        event: "stats_increment_failed",
        errorCode: "stats_increment_failed",
        maxAttempts: 2,
        retryDelayMs: 1,
      }
    );

    await flushBackgroundTasksForTests();
  } finally {
    console.error = original;
  }

  assert.equal(
    lines.some(
      (line) =>
        line.includes('"event":"stats_increment_failed"') &&
        line.includes('"errorCode":"stats_increment_failed"')
    ),
    true
  );
});
