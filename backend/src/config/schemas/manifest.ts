import { z } from "zod";

const sha256 = z.string().regex(/^[a-f0-9]{64}$/i);

export const sourceManifestSchema = z
  .object({
    file: z.string().min(1),
    sha256,
    bytes: z.number().int().min(0),
    format: z.string().min(1).optional(),
    entries: z.number().int().min(0).optional(),
    fetchedAt: z.string().min(1).optional(),
    sourceUrl: z.string().url().optional(),
    license: z.string().min(1).optional(),
  })
  .loose();

export const manifestCountsSchema = z
  .object({
    sourceLines: z.number().int().min(0),
    uniqueHosts: z.number().int().min(0),
    uniqueUrls: z.number().int().min(0),
    duplicates: z.number().int().min(0),
    rejectedLines: z.number().int().min(0),
    providers: z.number().int().min(0),
    rules: z.number().int().min(0),
  })
  .loose();

export const manifestSchema = z
  .object({
    artifactVersion: z.string().min(1),
    schemaVersion: z.number().int().positive(),
    minEngineVersion: z.string().min(1),
    validatorVersion: z.string().min(1),
    builtAt: z.string().min(1),
    sources: z.array(sourceManifestSchema),
    artifactSha256: sha256,
    artifactFiles: z
      .record(
        z.string(),
        z.object({
          sha256,
          bytes: z.number().int().min(0),
        })
      )
      .optional(),
    counts: manifestCountsSchema,
  })
  .loose();

export type Manifest = z.infer<typeof manifestSchema>;
