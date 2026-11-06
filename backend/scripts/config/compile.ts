import "dotenv/config";
import path from "node:path";
import {
  compileConfig,
  ConfigCompileError,
  type CompileOptions,
} from "./compiler.js";

/**
 * `npm run config:compile`
 *
 * Validates the sources and emits the deterministic compiled artifacts under
 * `dist/config/compiled/` (or `--out`). Any validation error aborts the build.
 */

const args = process.argv.slice(2);

const readFlag = (name: string): string | undefined => {
  const index = args.indexOf(name);

  return index === -1 ? undefined : args[index + 1];
};

const options: CompileOptions = {};

const root = readFlag("--root");

if (root) {
  options.root = root;
}

const out = readFlag("--out");

if (out) {
  options.outDir = path.resolve(out);
}

const indexKind = readFlag("--index");

if (indexKind === "mphf" || indexKind === "sorted") {
  options.indexKind = indexKind;
}

try {
  const result = compileConfig(options);

  for (const warning of result.warnings) {
    console.warn(
      `warning: ${warning.file} -> ${warning.field} (${warning.code}): ${warning.message}`
    );
  }

  console.log(
    [
      `Compiled ${result.manifest.counts.providers} providers,`,
      `${result.manifest.counts.uniqueHosts.toLocaleString()} hosts,`,
      `${result.manifest.counts.uniqueUrls.toLocaleString()} URLs,`,
      `${result.manifest.counts.rules} rules`,
    ].join(" ")
  );
  console.log(`Artifact version: ${result.manifest.artifactVersion}`);
  console.log(`Output: ${result.outDir}`);
} catch (error) {
  if (error instanceof ConfigCompileError) {
    for (const issue of error.issues) {
      console.error(
        `error: ${issue.file} -> ${issue.field}${
          issue.index === null ? "" : `[${issue.index}]`
        } (${issue.code}): ${issue.message}`
      );
    }

    console.error(
      `\nConfig compile failed with ${error.issues.length} error(s).`
    );
  } else {
    console.error("Config compile failed:", error);
  }

  process.exitCode = 1;
}
