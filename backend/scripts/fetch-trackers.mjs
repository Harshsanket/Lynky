import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Download the AdGuard tracking-filter and Legitimate URL Shortener sources
 * into `config/trackers/generic/`.
 *
 * Run with `npm run trackers:fetch` before a deploy, then rebuild so the
 * compiler parses the new files. Downloads are atomic and capped so an
 * interrupted refresh cannot leave a partial list behind.
 */

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const trackersDir = path.join(
  scriptDir,
  "..",
  "config",
  "trackers",
  "generic"
);

const MAX_FILE_BYTES = 50 * 1024 * 1024;

const sources = [
  {
    file: "adguard-trackparam-allowlist.txt",
    url: "https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/TrackParamFilter/sections/allowlist.txt",
  },
  {
    file: "adguard-trackparam-general-url.txt",
    url: "https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/TrackParamFilter/sections/general_url.txt",
  },
  {
    file: "adguard-trackparam-specific.txt",
    url: "https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/TrackParamFilter/sections/specific.txt",
  },
  {
    file: "legitimate-url-shortener.txt",
    url: "https://raw.githubusercontent.com/DandelionSprout/adfilt/master/LegitimateURLShortener.txt",
  },
];

const download = async ({ file, url }) => {
  const target = path.join(trackersDir, file);
  const temporary = `${target}.tmp`;
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "lynky-trackers-fetcher/1.0",
    },
  });

  if (!response.ok) {
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
    `[trackers] ${file}: ${(body.byteLength / 1024).toFixed(1)} KB`
  );
};

const run = async () => {
  await fs.mkdir(trackersDir, { recursive: true });

  let failed = 0;

  for (const source of sources) {
    try {
      await download(source);
    } catch (error) {
      failed++;
      console.error(
        `[trackers] failed ${source.file}: ${String(
          error?.message ?? error
        )}`
      );
      await fs.rm(`${path.join(trackersDir, source.file)}.tmp`, {
        force: true,
      });
    }
  }

  if (failed > 0) {
    process.exitCode = 1;
  }

  console.log(
    `\nTracker sources refreshed in ${trackersDir}. Rebuild to compile them.`
  );
};

run().catch((error) => {
  console.error("Tracker refresh failed:", error);
  process.exitCode = 1;
});
