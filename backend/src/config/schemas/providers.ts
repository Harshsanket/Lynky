import { z } from "zod";
import {
  CONFIG_SCHEMA_VERSION,
  hostHintSchema,
  nonEmptyString,
} from "./common.js";

export const providerSchema = z
  .object({
    id: nonEmptyString.max(200),
    urlPattern: z.string().min(1).max(4096),
    hostHints: z.array(hostHintSchema).default([]),
    completeProvider: z.boolean(),
    rules: z.array(nonEmptyString).default([]),
    referralMarketing: z.array(nonEmptyString).default([]),
    exceptions: z.array(nonEmptyString).default([]),
    redirections: z.array(nonEmptyString).default([]),
    rawRules: z.array(nonEmptyString).default([]),
  })
  .loose();

export const providersDatasetSchema = z
  .object({
    schemaVersion: z.literal(CONFIG_SCHEMA_VERSION),
    providers: z.array(providerSchema).min(1),
  })
  .loose();

export const overrideSchema = z
  .object({
    provider: nonEmptyString.max(200),
    action: z.enum(["add", "remove", "disable", "patch"]),
    reason: nonEmptyString,
    reviewBy: z.string().min(1).optional(),
    providerDefinition: providerSchema.optional(),
    addRules: z.array(nonEmptyString).optional(),
    removeRules: z.array(nonEmptyString).optional(),
    addExceptions: z.array(nonEmptyString).optional(),
    removeExceptions: z.array(nonEmptyString).optional(),
    addRedirections: z.array(nonEmptyString).optional(),
    removeRedirections: z.array(nonEmptyString).optional(),
    addHostHints: z.array(hostHintSchema).optional(),
    removeHostHints: z.array(hostHintSchema).optional(),
    setCompleteProvider: z.boolean().optional(),
  })
  .loose();

export const overridesDatasetSchema = z
  .object({
    schemaVersion: z.literal(CONFIG_SCHEMA_VERSION),
    overrides: z.array(overrideSchema),
  })
  .loose();

export type Provider = z.infer<typeof providerSchema>;
export type Override = z.infer<typeof overrideSchema>;
