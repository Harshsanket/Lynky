import { z } from "zod";
import {
  CONFIG_SCHEMA_VERSION,
  hostnameSchema,
  nonEmptyString,
} from "./common.js";

export const allowlistSchema = z
  .object({
    schemaVersion: z.literal(CONFIG_SCHEMA_VERSION),
    global: z.array(nonEmptyString).default([]),
    domains: z.record(hostnameSchema, z.array(nonEmptyString)).default({}),
  })
  .loose();

export type AllowlistConfig = z.infer<typeof allowlistSchema>;
