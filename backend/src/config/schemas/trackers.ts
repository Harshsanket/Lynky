import { z } from "zod";
import { CONFIG_SCHEMA_VERSION, nonEmptyString } from "./common.js";

/** `trackers/generic/lynky.json` and `clearurls-global.json`. */
export const trackerDatasetSchema = z
  .object({
    schemaVersion: z.literal(CONFIG_SCHEMA_VERSION),
    caseInsensitive: z.boolean().default(true),
    exact: z.array(nonEmptyString).default([]),
    prefixes: z.array(nonEmptyString).default([]),
    patterns: z.array(nonEmptyString).default([]),
    exceptions: z.array(nonEmptyString).default([]),
    source: z.string().min(1).optional(),
    upstreamVersion: z.string().min(1).optional(),
  })
  .loose();

export type TrackerDataset = z.infer<typeof trackerDatasetSchema>;
