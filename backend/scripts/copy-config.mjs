import { cpSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Copy the runtime JSON rules into `dist/` after `tsc`.
 *
 * The loaders resolve `dist/config` when running the compiled server, but
 * `tsc` only emits JavaScript. Keeping the copy in the build script means the
 * server works regardless of the directory it is started from.
 */
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.join(scriptDir, "..");

cpSync(
  path.join(backendDir, "config"),
  path.join(backendDir, "dist", "config"),
  { recursive: true }
);

console.log("Copied config/ into dist/config/");
