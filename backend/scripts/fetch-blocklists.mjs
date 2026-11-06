import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Download the operator-supplied blocklists into `config/blocklists/`.
 *
 * Run with `npm run blocklists:fetch` before a deploy (and on a daily cron if
 * the server is long-lived), then restart/rebuild so the loader picks up the
 * new files. Files are written atomically via a temporary file, so an
 * interrupted download cannot leave a half-written list in place.
 */

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const blocklistsDir = path.join(
  scriptDir,
  "..",
  "config",
  "blocklists"
);

const MAX_FILE_BYTES = 50 * 1024 * 1024;

const sources = [
  {
    file: "hagezi-list-light.txt",
    url: "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/wildcard/light.txt",
  },
  {
    file: "nsfw-onlydomains.txt",
    url: "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/wildcard/nsfw-onlydomains.txt",
  },
  {
    file: "gambling-onlydomains.txt",
    url: "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/wildcard/gambling-onlydomains.txt",
  },
  {
    file: "urlshortener-onlydomains.txt",
    url: "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/wildcard/urlshortener-onlydomains.txt",
  },
  {
    file: "phishing-domains.txt",
    url: "https://phishing.army/download/phishing_army_blocklist_extended.txt",
  },
  {
    file: "urlhaus.txt",
    url:
      process.env.URLHAUS_HOSTFILE_URL ??
      "https://urlhaus.abuse.ch/downloads/hostfile/",
    optional: true,
  },
];

const download = async ({ file, url, optional }) => {
  const target = path.join(blocklistsDir, file);
  const temporary = `${target}.tmp`;
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "lynky-blocklist-fetcher/1.0",
    },
  });

  if (!response.ok) {
    if (optional) {
      console.warn(
        `[blocklists] skipped optional ${file}: HTTP ${response.status} (existing file kept)`
      );
      return false;
    }

    throw new Error(`${file}: HTTP ${response.status}`);
  }

  const body = new Uint8Array(await response.arrayBuffer());

  if (body.byteLength === 0 || body.byteLength > MAX_FILE_BYTES) {
    throw new Error(
      `${file}: unexpected size ${body.byteLength} bytes`
    );
  }

  await fs.writeFile(temporary, body);
  await fs.rename(temporary, target);

  console.log(
    `[blocklists] ${file}: ${(body.byteLength / 1024 / 1024).toFixed(1)} MB`
  );

  return true;
};

const run = async () => {
  await fs.mkdir(blocklistsDir, { recursive: true });

  let failed = 0;

  for (const source of sources) {
    try {
      await download(source);
    } catch (error) {
      if (!source.optional) {
        failed++;
      }

      const label = source.optional ? "skipped optional" : "failed";

      console.error(
        `[blocklists] ${label} ${source.file}: ${String(
          error?.message ?? error
        )}`
      );
      await fs.rm(`${path.join(blocklistsDir, source.file)}.tmp`, {
        force: true,
      });
    }
  }

  if (failed > 0) {
    process.exitCode = 1;
  }

  console.log(
    `\nBlocklists refreshed in ${blocklistsDir}. Restart the backend to load them.`
  );
};

run().catch((error) => {
  console.error("Blocklist refresh failed:", error);
  process.exitCode = 1;
});
