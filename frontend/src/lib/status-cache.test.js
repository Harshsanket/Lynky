import test from 'node:test';
import assert from 'node:assert/strict';

import { createStatusCache } from './status-cache.js';

const makeStorage = () => {
  const values = new Map();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

test('deduplicates concurrent status loads and honours TTL', async () => {
  let now = 0;
  let calls = 0;
  const cache = createStatusCache({
    load: async () => {
      calls += 1;
      return { online: true, totalLinks: 7 };
    },
    ttlMs: 1000,
    storage: makeStorage(),
    now: () => now,
  });

  const [first, second] = await Promise.all([
    cache.get(),
    cache.get(),
  ]);

  assert.deepEqual(first, { online: true, totalLinks: 7 });
  assert.deepEqual(second, first);
  assert.equal(calls, 1);

  await cache.get();
  assert.equal(calls, 1);

  now = 1001;
  await cache.get();
  assert.equal(calls, 2);
});

test('returns the last value with stale=true on a failed refresh', async () => {
  let now = 0;
  let fail = false;
  const cache = createStatusCache({
    load: async () => {
      if (fail) throw new Error('offline');
      return { online: true, totalLinks: 3 };
    },
    ttlMs: 1000,
    storage: makeStorage(),
    now: () => now,
  });

  assert.deepEqual(await cache.get(), { online: true, totalLinks: 3 });

  fail = true;
  now = 2000;

  assert.deepEqual(await cache.get(), {
    online: true,
    totalLinks: 3,
    stale: true,
  });
});

test('throttles refresh events to the cache window', async () => {
  let now = 0;
  let calls = 0;
  const cache = createStatusCache({
    load: async () => {
      calls += 1;
      return { online: true, totalLinks: calls };
    },
    ttlMs: 1000,
    storage: makeStorage(),
    now: () => now,
  });

  await cache.get();
  await cache.refresh();
  assert.equal(calls, 1);

  now = 31_000;
  await cache.refresh();
  assert.equal(calls, 2);
});
