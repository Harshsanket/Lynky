import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/lynky-test";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.EXPIRATION_DAYS = "30";

const { MemoryCacheStore } = await import(
  "../service/redis.client.js"
);
const {
  setCacheStoreForTests,
  getCacheStore,
} = await import("../service/redis.client.js");
const {
  getCachedLink,
  setCachedLink,
  invalidateLinkCache,
  recordVisitWindow,
} = await import("../service/link-cache.service.js");

const store = new MemoryCacheStore();

setCacheStoreForTests(store);

test("stores and reads a hot link entry", async () => {
  const expiresAt = new Date(Date.now() + 60_000);

  await setCachedLink("abc123", {
    originalUrl: "ciphertext",
    expiresAt,
  });

  const cached = await getCachedLink("abc123");

  assert.equal(cached?.originalUrl, "ciphertext");
  assert.equal(cached?.expiresAt.toISOString(), expiresAt.toISOString());
});

test("rejects an expired cached entry", async () => {
  await getCacheStore().set(
    "link:expired",
    JSON.stringify({
      originalUrl: "ciphertext",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    }),
    60
  );

  assert.equal(await getCachedLink("expired"), null);
});

test("caps cache lifetime by the link expiry", async () => {
  await setCachedLink("short-lived", {
    originalUrl: "ciphertext",
    expiresAt: new Date(Date.now() + 250),
  });

  assert.ok(await getCachedLink("short-lived"));

  await new Promise((resolve) => setTimeout(resolve, 350));

  assert.equal(await getCachedLink("short-lived"), null);
});

test("drops corrupt cache entries", async () => {
  await getCacheStore().set("link:corrupt", "{not json", 60);

  assert.equal(await getCachedLink("corrupt"), null);
  assert.equal(await getCacheStore().get("link:corrupt"), null);
});

test("invalidates both link and hot keys", async () => {
  await setCachedLink("gone", {
    originalUrl: "ciphertext",
    expiresAt: new Date(Date.now() + 60_000),
  });
  await getCacheStore().set("hot:gone", "1", 60);

  await invalidateLinkCache("gone");

  assert.equal(await getCacheStore().get("link:gone"), null);
  assert.equal(await getCacheStore().get("hot:gone"), null);
});

test("invalidates link and hot keys in a single pipeline call", async () => {
  const batchingStore = new MemoryCacheStore();
  const originalPipeline = batchingStore.pipeline.bind(batchingStore);
  let pipelineCalls = 0;

  batchingStore.pipeline = async (commands) => {
    pipelineCalls += 1;
    await originalPipeline(commands);
  };

  setCacheStoreForTests(batchingStore);

  await batchingStore.set("link:batched", "ciphertext", 60);
  await batchingStore.set("hot:batched", "1", 60);

  await invalidateLinkCache("batched");

  assert.equal(pipelineCalls, 1);
  assert.equal(await batchingStore.get("link:batched"), null);
  assert.equal(await batchingStore.get("hot:batched"), null);

  setCacheStoreForTests(store);
});

test("counts visits in the current and previous window", async () => {
  assert.ok((await recordVisitWindow("window")) >= 1);
  assert.ok((await recordVisitWindow("window")) >= 2);
});

test("cache failures degrade without throwing", async () => {
  const failing = {
    get: async () => {
      throw new Error("redis down");
    },
    set: async () => {
      throw new Error("redis down");
    },
    del: async () => {
      throw new Error("redis down");
    },
    incrBy: async () => {
      throw new Error("redis down");
    },
    expire: async () => {
      throw new Error("redis down");
    },
    hGetAll: async () => {
      throw new Error("redis down");
    },
    hIncrBy: async () => {
      throw new Error("redis down");
    },
    hSet: async () => {
      throw new Error("redis down");
    },
    hDel: async () => {
      throw new Error("redis down");
    },
    sAdd: async () => {
      throw new Error("redis down");
    },
    sMembers: async () => {
      throw new Error("redis down");
    },
    sRem: async () => {
      throw new Error("redis down");
    },
    pipeline: async () => {
      throw new Error("redis down");
    },
  };

  setCacheStoreForTests(failing as any);

  assert.equal(await getCachedLink("anything"), null);
  await setCachedLink("anything", {
    originalUrl: "ciphertext",
    expiresAt: new Date(Date.now() + 60_000),
  });
  assert.equal(await recordVisitWindow("anything"), 0);

  setCacheStoreForTests(store);
});
