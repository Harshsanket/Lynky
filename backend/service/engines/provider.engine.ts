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

export class PairRuleBucket {
  private readonly exact: Set<string>;
  private readonly sources: readonly string[];
  private regex: readonly RegExp[] | null = null;

  constructor(exact: readonly string[], patterns: readonly string[]) {
    this.exact = new Set(exact);
    this.sources = patterns;
  }

  private patterns(): readonly RegExp[] {
    if (this.regex === null) {
      this.regex = this.sources.map(
        (source) => new RegExp(source, "i")
      );
    }

    return this.regex;
  }

  matches(key: string, value: string): boolean {
    const pair = `${key}=${value}`.toLowerCase();

    if (this.exact.has(pair)) {
      return true;
    }

    if (this.sources.length === 0) {
      return false;
    }

    return this.patterns().some((pattern) => pattern.test(pair));
  }
}

export interface RuntimeProvider {
  artifact: CompiledProviderArtifact;
  urlPattern: RegExp;
  rules: RuleBucket;
  pairRules: PairRuleBucket;
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
  private readonly artifacts: readonly CompiledProviderArtifact[];
  private readonly runtime: Array<RuntimeProvider | null>;
  private readonly hostIndex = new Map<string, number[]>();
  private readonly fallback: number[] = [];
  private readonly candidateMarks: number[];
  private candidateGeneration = 0;

  constructor(artifact: ProvidersArtifact) {
    this.artifacts = artifact.providers;
    this.runtime = new Array(artifact.providers.length).fill(null);
    this.candidateMarks = new Array(artifact.providers.length).fill(0);

    this.artifacts.forEach((provider, index) => {
      if (provider.hostHints.length === 0) {
        this.fallback.push(index);
        return;
      }

      for (const hint of provider.hostHints) {
        const bucket = this.hostIndex.get(hint);

        if (bucket) {
          bucket.push(index);
        } else {
          this.hostIndex.set(hint, [index]);
        }
      }
    });
  }

  /** Compatibility view; builds all providers only if explicitly accessed. */
  get providers(): readonly RuntimeProvider[] {
    return this.artifacts.map((_provider, index) =>
      this.runtimeProvider(index)
    );
  }

  private runtimeProvider(index: number): RuntimeProvider {
    const cached = this.runtime[index];

    if (cached) {
      return cached;
    }

    const provider = this.artifacts[index]!;
    const runtime: RuntimeProvider = {
      artifact: provider,
      urlPattern: new RegExp(provider.urlPattern, "i"),
      rules: new RuleBucket(provider.rules),
      pairRules: new PairRuleBucket(
        provider.pairExact,
        provider.pairPatterns
      ),
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
    };

    this.runtime[index] = runtime;

    return runtime;
  }

  candidatesFor(hostname: string): number[] {
    const generation = ++this.candidateGeneration;
    const indices: number[] = [];
    const mark = (index: number): void => {
      if (this.candidateMarks[index] === generation) {
        return;
      }

      this.candidateMarks[index] = generation;
      indices.push(index);
    };

    for (const index of this.fallback) {
      mark(index);
    }

    for (const key of candidateKeys(hostname)) {
      const bucket = this.hostIndex.get(key);

      if (bucket) {
        for (const index of bucket) {
          mark(index);
        }
      }
    }

    return indices.sort((left, right) => left - right);
  }

  /** Matching providers, in original provider order. */
  match(urlString: string, hostname: string): RuntimeProvider[] {
    const matched: RuntimeProvider[] = [];

    for (const index of this.candidatesFor(hostname)) {
      const provider = this.runtimeProvider(index);

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
