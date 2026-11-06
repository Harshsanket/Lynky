import type { BlocklistFormat } from "./blocklist-formats.js";

export interface TrackerGroupArtifact {
  exact: string[];
  prefixes: string[];
  patterns: string[];
  exceptions: string[];
}

export interface TrackersArtifact {
  schemaVersion: number;
  groups: {
    lynky: TrackerGroupArtifact;
    clearurlsGlobal: TrackerGroupArtifact;
  };
}

export interface RuleBucketsArtifact {
  exact: string[];
  prefixes: string[];
  regex: string[];
}

export interface CompiledProviderArtifact {
  id: string;
  urlPattern: string;
  hostHints: string[];
  completeProvider: boolean;
  rules: RuleBucketsArtifact;
  referralMarketing: RuleBucketsArtifact;
  exceptions: string[];
  redirections: string[];
  rawRules: string[];
}

export interface ProvidersArtifact {
  schemaVersion: number;
  providers: CompiledProviderArtifact[];
}

export interface AllowlistArtifact {
  schemaVersion: number;
  global: string[];
  domains: Record<string, string[]>;
}

export interface PolicyArtifact {
  schemaVersion: number;
  maxDepth: number;
  genericRedirectUnwrap: boolean;
  genericUnwrapParameters: string[];
  removeJunkFragments: boolean;
}

export interface BlocklistHeader {
  indexKind: "mphf" | "sorted";
  seed: number;
  bucketCount: number;
  tableSize: number;
  hostCount: number;
  urlCount: number;
  collisionCount: number;
}

export interface ArtifactManifestSource {
  file: string;
  sha256: string;
  bytes: number;
  format?: BlocklistFormat | string | undefined;
  entries?: number | undefined;
  fetchedAt?: string | undefined;
  sourceUrl?: string | undefined;
  license?: string | undefined;
}

export interface ArtifactManifest {
  artifactVersion: string;
  schemaVersion: number;
  minEngineVersion: string;
  validatorVersion: string;
  builtAt: string;
  sources: ArtifactManifestSource[];
  artifactSha256: string;
  artifactFiles?: Record<string, { sha256: string; bytes: number }> | undefined;
  counts: {
    sourceLines: number;
    uniqueHosts: number;
    uniqueUrls: number;
    duplicates: number;
    rejectedLines: number;
    providers: number;
    rules: number;
  };
}

export interface LoadedArtifacts {
  dir: string;
  manifest: ArtifactManifest;
  trackers: TrackersArtifact;
  providers: ProvidersArtifact;
  allowlist: AllowlistArtifact;
  policy: PolicyArtifact;
  artifactHashValid: boolean;
}

export type BlocklistStatus = "ok" | "degraded" | "closed";
