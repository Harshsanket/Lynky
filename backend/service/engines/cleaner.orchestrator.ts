import type { PolicyArtifact } from "../../src/config/artifact-types.js";
import { PublicError } from "../public-error.service.js";
import { MESSAGES } from "../url-host-validator.service.js";
import { AllowlistEngine } from "./allowlist.engine.js";
import { ProviderEngine, type RuntimeProvider } from "./provider.engine.js";
import { TrackerEngine } from "./tracker.engine.js";

export interface CleanUrlOptions {
  depth?: number;
  maxDepth?: number;
}

const decodeSafe = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const isHttpUrl = (value: string): boolean => {
  const trimmed = value.trim();

  if (!/^https?:\/\/[^/\s]/i.test(trimmed)) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const decodeVariants = (value: string): string[] => {
  const variants: string[] = [];
  let current = value;

  for (let index = 0; index < 3; index++) {
    let decoded: string;

    try {
      decoded = decodeURIComponent(current);
    } catch {
      break;
    }

    if (decoded === current) {
      break;
    }

    variants.push(decoded);
    current = decoded;
  }

  return variants;
};

const dedupeParams = (url: URL): void => {
  const seen = new Set<string>();
  const entries: Array<[string, string]> = [];

  for (const [key, value] of url.searchParams) {
    const pair = JSON.stringify([key, value]);

    if (!seen.has(pair)) {
      seen.add(pair);
      entries.push([key, value]);
    }
  }

  url.search = "";

  for (const [key, value] of entries) {
    url.searchParams.append(key, value);
  }
};

const normalizePorts = (url: URL): void => {
  if (
    (url.protocol === "http:" && url.port === "80") ||
    (url.protocol === "https:" && url.port === "443")
  ) {
    url.port = "";
  }
};

/**
 * Compiled-engine equivalent of the legacy `cleanUrl` pipeline.
 *
 * Stage order is deliberately identical: wrapper unwrap, provider rules,
 * raw rules, tracker groups, allowlist overlay, dedupe, fragment cleanup.
 * No engine mutates another engine's data.
 */
export class CleanerOrchestrator {
  private readonly policy: PolicyArtifact;
  private readonly genericUnwrapParameters: Set<string>;

  constructor(
    private readonly trackers: TrackerEngine,
    private readonly allowlist: AllowlistEngine,
    private readonly providers: ProviderEngine,
    policy: PolicyArtifact
  ) {
    this.policy = policy;
    this.genericUnwrapParameters = new Set(
      policy.genericUnwrapParameters.map((parameter) =>
        parameter.toLowerCase()
      )
    );
  }

  private isTrackingKey(key: string, urlString?: string): boolean {
    if (this.trackers.matches(key, urlString)) {
      return true;
    }

    if (!key.includes("%")) {
      return false;
    }

    return decodeVariants(key).some(
      (variant) =>
        variant !== key && this.trackers.matches(variant, urlString)
    );
  }

  private isLynkyTrackingKey(key: string): boolean {
    if (this.trackers.lynky.matches(key)) {
      return true;
    }

    if (!key.includes("%")) {
      return false;
    }

    return decodeVariants(key).some(
      (variant) =>
        variant !== key && this.trackers.lynky.matches(variant)
    );
  }

  private isJunkFragment(fragment: string): boolean {
    if (fragment === "") {
      return true;
    }

    const decoded = decodeSafe(fragment);

    if (
      decoded === "" ||
      decoded === "#" ||
      decoded === "!" ||
      decoded === "/"
    ) {
      return true;
    }

    const tokens = decoded
      .split("&")
      .map((token) => token.trim())
      .filter((token) => token.length > 0);

    if (tokens.length === 0) {
      return true;
    }

    return tokens.every((token) => {
      const key = token.split("=")[0] ?? token;
      return key === "" || this.isLynkyTrackingKey(key);
    });
  }

  private extractWrappedUrl(
    urlString: string,
    url: URL,
    providers: readonly RuntimeProvider[]
  ): string | null {
    for (const provider of providers) {
      if (
        provider.exceptions.some((exception) =>
          exception.test(urlString)
        )
      ) {
        continue;
      }

      for (const redirection of provider.redirections) {
        const match = urlString.match(redirection);
        const captured = match?.[1];

        if (!captured) {
          continue;
        }

        const decoded = decodeSafe(captured);

        if (isHttpUrl(decoded)) {
          return decoded;
        }
      }
    }

    if (!this.policy.genericRedirectUnwrap) {
      return null;
    }

    for (const key of url.searchParams.keys()) {
      if (!this.genericUnwrapParameters.has(key.toLowerCase())) {
        continue;
      }

      const value = url.searchParams.get(key);

      if (value && isHttpUrl(value)) {
        return value;
      }
    }

    return null;
  }

  clean(inputUrl: string, options: CleanUrlOptions = {}): string {
    const depth = options.depth ?? 0;
    const maxDepth = options.maxDepth ?? this.policy.maxDepth;

    if (depth > maxDepth) {
      throw new PublicError(
        `Maximum URL cleaning depth of ${maxDepth} exceeded`
      );
    }

    if (typeof inputUrl !== "string") {
      throw new PublicError("URL is required");
    }

    const originalUrlString = inputUrl.trim();

    if (!originalUrlString) {
      throw new PublicError("URL is required");
    }

    if (originalUrlString.includes("\\")) {
      throw new PublicError("Invalid URL");
    }

    let url: URL;

    try {
      url = new URL(originalUrlString);
    } catch {
      throw new PublicError("Invalid URL");
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new PublicError("Only HTTP and HTTPS URLs are allowed");
    }

    if (!url.hostname) {
      throw new PublicError("Invalid URL");
    }

    if (url.hostname.endsWith(".")) {
      url.hostname = url.hostname.slice(0, -1);
    }

    const normalizedUrlString = url.toString();
    const matchingProviders = this.providers.match(
      normalizedUrlString,
      url.hostname
    );

    const wrappedUrl = this.extractWrappedUrl(
      normalizedUrlString,
      url,
      matchingProviders
    );

    if (wrappedUrl) {
      if (depth < maxDepth) {
        return this.clean(wrappedUrl, {
          depth: depth + 1,
          maxDepth,
        });
      }

      throw new PublicError(
        `Maximum URL cleaning depth of ${maxDepth} exceeded`
      );
    }

    const allowlist = this.allowlist.forHost(url.hostname);

    /*
     * Provider contract:
     * - a matching provider exception skips all of that provider's rules;
     * - `completeProvider` removes every non-allowlisted key and ignores the
     *   provider's `rules` list;
     * - otherwise exact/prefix/regex rules remove matching keys, then referral
     *   rules run, then raw URL rules rewrite the serialized URL;
     * - every provider is evaluated in original order, and the allowlist is
     *   checked before every removal path.
     */
    for (const provider of matchingProviders) {
      if (
        provider.exceptions.some((exception) =>
          exception.test(normalizedUrlString)
        )
      ) {
        continue;
      }

      if (provider.artifact.completeProvider) {
        for (const key of [...url.searchParams.keys()]) {
          if (!allowlist.has(key)) {
            url.searchParams.delete(key);
          }
        }
      } else {
        for (const key of [...url.searchParams.keys()]) {
          if (allowlist.has(key)) {
            continue;
          }

          if (provider.rules.matches(key)) {
            url.searchParams.delete(key);
          }
        }
      }

      for (const key of [...url.searchParams.keys()]) {
        if (allowlist.has(key)) {
          continue;
        }

        if (provider.referralMarketing.matches(key)) {
          url.searchParams.delete(key);
        }
      }

      if (provider.rawRules.length > 0) {
        let cleanedUrlString = url.toString();

        for (const rawRule of provider.rawRules) {
          cleanedUrlString = cleanedUrlString.replace(rawRule, "");
        }

        try {
          url = new URL(cleanedUrlString);
        } catch {
          throw new PublicError(MESSAGES.invalid);
        }
      }
    }

    for (const key of [...url.searchParams.keys()]) {
      if (allowlist.has(key)) {
        continue;
      }

      if (this.isTrackingKey(key, normalizedUrlString)) {
        url.searchParams.delete(key);
      }
    }

    dedupeParams(url);

    for (const key of [...url.searchParams.keys()]) {
      if (key === "") {
        url.searchParams.delete(key);
      }
    }

    if (
      this.policy.removeJunkFragments &&
      url.hash !== "" &&
      this.isJunkFragment(url.hash.slice(1))
    ) {
      url.hash = "";
    }

    normalizePorts(url);

    let result = url.toString();

    if (result.endsWith("#")) {
      result = result.slice(0, -1);
    }

    if (result.endsWith("?")) {
      result = result.slice(0, -1);
    }

    return result;
  }
}
