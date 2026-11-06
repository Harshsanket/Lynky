import type { TrackerGroupArtifact } from "../../src/config/artifact-types.js";

export class TrackerGroupEngine {
  readonly exact: Set<string>;
  readonly prefixes: readonly string[];
  readonly patterns: readonly RegExp[];
  readonly exceptions: readonly RegExp[];

  constructor(group: TrackerGroupArtifact) {
    this.exact = new Set(group.exact);
    this.prefixes = group.prefixes;
    this.patterns = group.patterns.map(
      (pattern) => new RegExp(pattern, "i")
    );
    this.exceptions = group.exceptions.map(
      (pattern) => new RegExp(pattern, "i")
    );
  }

  matches(key: string, urlString?: string): boolean {
    if (
      urlString !== undefined &&
      this.exceptions.some((exception) => exception.test(urlString))
    ) {
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
}

/** Applies the Lynky and ClearURLs global tracker groups separately. */
export class TrackerEngine {
  readonly lynky: TrackerGroupEngine;
  readonly clearurlsGlobal: TrackerGroupEngine;

  constructor(groups: {
    lynky: TrackerGroupArtifact;
    clearurlsGlobal: TrackerGroupArtifact;
  }) {
    this.lynky = new TrackerGroupEngine(groups.lynky);
    this.clearurlsGlobal = new TrackerGroupEngine(groups.clearurlsGlobal);
  }

  matches(key: string, urlString?: string): boolean {
    return (
      this.lynky.matches(key, urlString) ||
      this.clearurlsGlobal.matches(key, urlString)
    );
  }
}
