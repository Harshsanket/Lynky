import { z } from "zod";
import { CONFIG_SCHEMA_VERSION, nonEmptyString } from "./common.js";

export const cleanerPolicySchema = z
  .object({
    schemaVersion: z.literal(CONFIG_SCHEMA_VERSION),
    maxDepth: z.number().int().min(1).max(5),
    genericRedirectUnwrap: z.boolean(),
    genericUnwrapParameters: z.array(nonEmptyString).default([]),
    removeJunkFragments: z.boolean(),
    allowDangerousGenericUnwrapParameters: z
      .array(nonEmptyString)
      .default([]),
  })
  .loose();

export type CleanerPolicy = z.infer<typeof cleanerPolicySchema>;
