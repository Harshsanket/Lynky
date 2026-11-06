import { z } from "zod";
import { BLOCKLIST_FORMATS } from "../blocklist-formats.js";
import { CONFIG_SCHEMA_VERSION } from "./common.js";

export const blocklistSourceSchema = z
  .object({
    file: z
      .string()
      .min(1)
      .max(255)
      .regex(
        /^[A-Za-z0-9._-]+\.txt$/,
        "must be a .txt filename without directories"
      ),
    format: z.enum(BLOCKLIST_FORMATS),
    required: z.boolean(),
    minEntries: z.number().int().min(0),
    sourceUrl: z.string().url().optional(),
    license: z.string().min(1).optional(),
    fetchedAt: z.string().min(1).optional(),
    sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/i, "must be a hex sha256")
      .optional(),
  })
  .loose();

export const blocklistSourcesSchema = z
  .object({
    schemaVersion: z.literal(CONFIG_SCHEMA_VERSION),
    sources: z.array(blocklistSourceSchema),
  })
  .loose();

export type BlocklistSource = z.infer<typeof blocklistSourceSchema>;
