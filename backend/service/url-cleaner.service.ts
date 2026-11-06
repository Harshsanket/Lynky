import { getEngineRuntime } from "./engines/runtime.js";
import type { CleanUrlOptions } from "./engines/cleaner.orchestrator.js";

export type { CleanUrlOptions };

/** Clean a URL with the compiled rule engine. */
export const cleanUrl = (
  inputUrl: string,
  options: CleanUrlOptions = {}
): string => getEngineRuntime().orchestrator.clean(inputUrl, options);
