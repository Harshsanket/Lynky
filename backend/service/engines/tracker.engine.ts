import type { TrackerGroupArtifact } from "../../src/config/artifact-types.js";

export interface TrackerGroupContext {
  excluded: boolean;
  exception: boolean;
}

export interface TrackerContext {
  lynky: TrackerGroupContext;
  external: TrackerGroupContext;
}

const emptyContext = (): TrackerGroupContext => ({
  excluded: false,
  exception: false,
});

const isGroupContext = (value: unknown): value is TrackerGroupContext =>
  Boolean(
    value &&
      typeof value === "object" &&
      "excluded" in value &&
      "exception" in value
  );

const isTrackerContext = (value: unknown): value is TrackerContext =>
  Boolean(
    value &&
      typeof value === "object" &&
      "lynky" in value &&
      "external" in value
  );

export class TrackerGroupEngine {
  readonly exact: Set<string>;
  readonly prefixes: readonly string[];
  readonly patterns: readonly RegExp[];
  readonly pairExact: Set<string>;
  readonly exceptions: readonly RegExp[];
  readonly excludeHosts: Set<string>;
  private readonly pairPatternSources: readonly string[];
  private pairPatterns: readonly RegExp[] | null = null;

  constructor(group: TrackerGroupArtifact) {
    this.exact = new Set(group.exact);
    this.prefixes = group.prefixes;
    this.patterns = group.patterns.map(
      (pattern) => new RegExp(pattern, "i")
    );
    this.pairExact = new Set(group.pairExact);
    this.pairPatternSources = group.pairPatterns;
    this.exceptions = group.exceptions.map(
      (pattern) => new RegExp(pattern, "i")
    );
    this.excludeHosts = new Set(group.excludeHosts);
  }

  private hostExcluded(hostname?: string): boolean {
    if (!hostname || this.excludeHosts.size === 0) {
      return false;
    }

    const host = hostname.toLowerCase().replace(/\.$/, "");
    let suffix = host;

    if (this.excludeHosts.has(suffix)) {
      return true;
    }

    for (let dot = host.indexOf("."); dot !== -1; dot = host.indexOf(".", dot + 1)) {
      suffix = host.slice(dot + 1);

      if (this.excludeHosts.has(suffix)) {
        return true;
      }
    }

    return false;
  }

  prepare(urlString?: string, hostname?: string): TrackerGroupContext {
    return {
      excluded: this.hostExcluded(hostname),
      exception:
        urlString !== undefined &&
        this.exceptions.some((exception) => exception.test(urlString)),
    };
  }

  private pairRegexes(): readonly RegExp[] {
    if (this.pairPatterns === null) {
      this.pairPatterns = this.pairPatternSources.map(
        (pattern) => new RegExp(pattern, "i")
      );
    }

    return this.pairPatterns;
  }

  matches(
    key: string,
    contextOrUrl?: TrackerGroupContext | string,
    hostname?: string
  ): boolean {
    const context = isGroupContext(contextOrUrl)
      ? contextOrUrl
      : this.prepare(
          typeof contextOrUrl === "string" ? contextOrUrl : undefined,
          hostname
        );

    if (context.excluded || context.exception) {
      return false;
    }

    const normalized = key.toLowerCase();

    if (this.exact.has(normalized)) {
      return true;
    }

    for (const prefix of this.prefixes) {
      if (normalized.startsWith(prefix)) {
        return true;
      }
    }

    for (const pattern of this.patterns) {
      if (pattern.test(normalized)) {
        return true;
      }
    }

    return false;
  }

  matchesPair(
    key: string,
    value: string,
    contextOrUrl?: TrackerGroupContext | string,
    hostname?: string
  ): boolean {
    const context = isGroupContext(contextOrUrl)
      ? contextOrUrl
      : this.prepare(
          typeof contextOrUrl === "string" ? contextOrUrl : undefined,
          hostname
        );

    if (context.excluded || context.exception) {
      return false;
    }

    const pair = `${key}=${value}`.toLowerCase();

    if (this.pairExact.has(pair)) {
      return true;
    }

    if (this.pairPatternSources.length === 0) {
      return false;
    }

    return this.pairRegexes().some((pattern) => pattern.test(pair));
  }
}

/** Applies the Lynky-owned and merged external tracker groups separately. */
export class TrackerEngine {
  readonly lynky: TrackerGroupEngine;
  readonly external: TrackerGroupEngine;

  constructor(groups: {
    lynky: TrackerGroupArtifact;
    external: TrackerGroupArtifact;
  }) {
    this.lynky = new TrackerGroupEngine(groups.lynky);
    this.external = new TrackerGroupEngine(groups.external);
  }

  prepare(urlString?: string, hostname?: string): TrackerContext {
    return {
      lynky: this.lynky.prepare(urlString, hostname),
      external: this.external.prepare(urlString, hostname),
    };
  }

  matches(
    key: string,
    contextOrUrl?: TrackerContext | string,
    hostname?: string
  ): boolean {
    const context = isTrackerContext(contextOrUrl)
      ? contextOrUrl
      : this.prepare(
          typeof contextOrUrl === "string" ? contextOrUrl : undefined,
          hostname
        );

    return (
      this.lynky.matches(key, context.lynky) ||
      this.external.matches(key, context.external)
    );
  }

  matchesPair(
    key: string,
    value: string,
    contextOrUrl?: TrackerContext | string,
    hostname?: string
  ): boolean {
    const context = isTrackerContext(contextOrUrl)
      ? contextOrUrl
      : this.prepare(
          typeof contextOrUrl === "string" ? contextOrUrl : undefined,
          hostname
        );

    return (
      this.lynky.matchesPair(key, value, context.lynky) ||
      this.external.matchesPair(key, value, context.external)
    );
  }
}
