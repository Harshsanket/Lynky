import type {
  CompiledProviderArtifact,
  ProvidersArtifact,
  RuleBucketsArtifact,
} from "../../src/config/artifact-types.js";
import { logError } from "../logger.js";

export class RuleBucket {
  private readonly exact: Set<string>;
  private readonly prefixes: readonly string[];
  private readonly regex: readonly RegExp[];

  constructor(bucket: RuleBucketsArtifact) {
    this.exact = new Set(bucket.exact);
    this.prefixes = bucket.prefixes;
    this.regex = bucket.regex.map((source) => new RegExp(source, "i"));
  }

  matches(key: string): boolean {
    const normalized = key.toLowerCase();

    if (this.exact.has(normalized)) {
      return true;
    }

    for (const prefix of this.prefixes) {
      if (normalized.startsWith(prefix)) {
        return true;
      }
    }

    for (const pattern of this.regex) {
      if (pattern.test(normalized)) {
        return true;
      }
    }

    return false;
  }
}

export interface RuntimeProvider {
  artifact: CompiledProviderArtifact;
  urlPattern: RegExp;
  rules: RuleBucket;
  referralMarketing: RuleBucket;
  exceptions: readonly RegExp[];
  redirections: readonly RegExp[];
  rawRules: readonly RegExp[];
}

const candidateKeys = (hostname: string): string[] => {
  const host = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  const keys = new Set<string>();
  const labels = host.split(".");

  keys.add(host);

  for (let index = 1; index < labels.length; index++) {
    keys.add(labels.slice(index).join("."));
  }

  // Stems such as `amazon` / `google` are host hints, not full suffixes.
  for (const label of labels) {
    keys.add(label);
  }

  return [...keys];
};

/**
 * Host-indexed provider prefilter.
 *
 * The index only chooses candidates; every candidate must still pass the
 * original `urlPattern` regex before it can affect cleaning.
 */
export class ProviderEngine {
  readonly providers: readonly RuntimeProvider[];
  private readonly hostIndex = new Map<string, number[]>();
  private readonly fallback: number[] = [];

  constructor(artifact: ProvidersArtifact) {
    this.providers = artifact.providers.map((provider) => ({
      artifact: provider,
      urlPattern: new RegExp(provider.urlPattern, "i"),
      rules: new RuleBucket(provider.rules),
      referralMarketing: new RuleBucket(provider.referralMarketing),
      exceptions: provider.exceptions.map(
        (pattern) => new RegExp(pattern, "i")
      ),
      redirections: provider.redirections.map(
        (pattern) => new RegExp(pattern, "i")
      ),
      rawRules: provider.rawRules.map(
        (pattern) => new RegExp(pattern, "gi")
      ),
    }));

    this.providers.forEach((provider, index) => {
      if (provider.artifact.hostHints.length === 0) {
        this.fallback.push(index);
        return;
      }

      for (const hint of provider.artifact.hostHints) {
        const bucket = this.hostIndex.get(hint);

        if (bucket) {
          bucket.push(index);
        } else {
          this.hostIndex.set(hint, [index]);
        }
      }
    });
  }

  candidatesFor(hostname: string): number[] {
    const indices = new Set<number>(this.fallback);

    for (const key of candidateKeys(hostname)) {
      const bucket = this.hostIndex.get(key);

      if (bucket) {
        for (const index of bucket) {
          indices.add(index);
        }
      }
    }

    return [...indices].sort((left, right) => left - right);
  }

  /** Matching providers, in original provider order. */
  match(urlString: string, hostname: string): RuntimeProvider[] {
    const matched: RuntimeProvider[] = [];

    for (const index of this.candidatesFor(hostname)) {
      const provider = this.providers[index]!;

      try {
        if (provider.urlPattern.test(urlString)) {
          matched.push(provider);
        }
      } catch (error) {
        logError("provider_rule_error", error, {
          errorCode: "provider_rule_error",
          providerId: provider.artifact.id,
        });
        throw error;
      }
    }

    return matched;
  }
}
