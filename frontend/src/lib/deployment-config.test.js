import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

test('Vercel rewrites SPA deep links to index.html', () => {
  const configPath = path.join(projectDir, 'vercel.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  assert.ok(Array.isArray(config.rewrites));

  const catchAll = config.rewrites.find(
    (rewrite) =>
      rewrite.destination === '/index.html' &&
      (rewrite.source === '/(.*)' ||
        rewrite.source === '/:path*'),
  );

  assert.ok(
    catchAll,
    'expected a catch-all rewrite to /index.html for /blog, /api, /about, and /api/usage',
  );
});
