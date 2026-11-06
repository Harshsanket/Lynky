import { getEngineRuntime } from "./engines/runtime.js";

export interface BlocklistScreeningResult {
  blocked: boolean;
  status: "ok" | "degraded" | "closed";
  reason?: string;
}

/** Create-time blocklist screen backed by the compiled artifact engine. */
export const screenBlocklist = (
  parsedUrl: URL
): BlocklistScreeningResult => {
  const result = getEngineRuntime().blocklist.check(parsedUrl);

  return {
    blocked: result.blocked,
    status: result.status,
    ...(result.reason ? { reason: result.reason } : {}),
  };
};
