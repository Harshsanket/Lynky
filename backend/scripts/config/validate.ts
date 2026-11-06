import "dotenv/config";
import { validateConfig } from "../../src/config/config-validation.js";

/**
 * `npm run config:validate`
 *
 * Validates the human-editable config sources with the full Zod + semantic +
 * cross-file + blocklist checks. Exits 1 on any error. Warnings are printed
 * with the same `file -> field -> index` shape but do not fail the build.
 */

const rootFlagIndex = process.argv.indexOf("--root");
const root =
  rootFlagIndex !== -1
    ? process.argv[rootFlagIndex + 1]
    : undefined;

const formatIssue = (issue: {
  file: string;
  field: string;
  index: number | string | null;
  code: string;
  message: string;
}): string => {
  const location =
    issue.index === null
      ? issue.field
      : `${issue.field}[${issue.index}]`;

  return `${issue.file} -> ${location} (${issue.code}): ${issue.message}`;
};

const result = validateConfig(root);

for (const warning of result.warnings) {
  console.warn(`warning: ${formatIssue(warning)}`);
}

for (const error of result.errors) {
  console.error(`error: ${formatIssue(error)}`);
}

if (!result.ok) {
  console.error(
    `\nConfig validation failed with ${result.errors.length} error(s).`
  );
  process.exitCode = 1;
} else {
  console.log(
    `Config validation passed (${result.warnings.length} warning(s)).`
  );
}
