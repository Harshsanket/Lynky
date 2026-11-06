import { z } from "zod";
import { ARTIFACT_SCHEMA_VERSION } from "../engine-version.js";

/** Optional full Zod validation of compiled artifacts (development only). */

const trackerGroupSchema = z.object({
  exact: z.array(z.string()),
  prefixes: z.array(z.string()),
  patterns: z.array(z.string()),
  exceptions: z.array(z.string()),
});

const ruleBucketsSchema = z.object({
  exact: z.array(z.string()),
  prefixes: z.array(z.string()),
  regex: z.array(z.string()),
});

const providerSchema = z.object({
  id: z.string().min(1),
  urlPattern: z.string().min(1),
  hostHints: z.array(z.string()),
  completeProvider: z.boolean(),
  rules: ruleBucketsSchema,
  referralMarketing: ruleBucketsSchema,
  exceptions: z.array(z.string()),
  redirections: z.array(z.string()),
  rawRules: z.array(z.string()),
});

const manifestSchema = z.object({
  artifactVersion: z.string().min(1),
  schemaVersion: z.number().int(),
  minEngineVersion: z.string().min(1),
  validatorVersion: z.string().min(1),
  builtAt: z.string().min(1),
  sources: z.array(
    z.object({
      file: z.string().min(1),
      sha256: z.string(),
      bytes: z.number().int().min(0),
      format: z.string().optional(),
      entries: z.number().int().min(0).optional(),
    })
  ),
  artifactSha256: z.string(),
  artifactFiles: z
    .record(
      z.string(),
      z.object({
        sha256: z.string(),
        bytes: z.number().int().min(0),
      })
    )
    .optional(),
  counts: z.object({
    sourceLines: z.number().int().min(0),
    uniqueHosts: z.number().int().min(0),
    uniqueUrls: z.number().int().min(0),
    duplicates: z.number().int().min(0),
    rejectedLines: z.number().int().min(0),
    providers: z.number().int().min(0),
    rules: z.number().int().min(0),
  }),
});

export const compiledArtifactsSchema = z.object({
  manifest: manifestSchema,
  trackers: z.object({
    schemaVersion: z.literal(ARTIFACT_SCHEMA_VERSION),
    groups: z.object({
      lynky: trackerGroupSchema,
      clearurlsGlobal: trackerGroupSchema,
    }),
  }),
  providers: z.object({
    schemaVersion: z.literal(ARTIFACT_SCHEMA_VERSION),
    providers: z.array(providerSchema),
  }),
  allowlist: z.object({
    schemaVersion: z.literal(ARTIFACT_SCHEMA_VERSION),
    global: z.array(z.string()),
    domains: z.record(z.string(), z.array(z.string())),
  }),
  policy: z.object({
    schemaVersion: z.literal(ARTIFACT_SCHEMA_VERSION),
    maxDepth: z.number().int().min(1).max(5),
    genericRedirectUnwrap: z.boolean(),
    genericUnwrapParameters: z.array(z.string()),
    removeJunkFragments: z.boolean(),
  }),
});
