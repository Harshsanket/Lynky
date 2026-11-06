import { logInfo, logWarn, setLogVersions } from "../logger.js";
import { loadCompiledArtifacts } from "../../src/config/artifacts.js";
import type { LoadedArtifacts } from "../../src/config/artifact-types.js";
import { AllowlistEngine } from "./allowlist.engine.js";
import {
  BlocklistEngine,
  loadBlocklistEngine,
} from "./blocklist.engine.js";
import { CleanerOrchestrator } from "./cleaner.orchestrator.js";
import { ProviderEngine } from "./provider.engine.js";
import { TrackerEngine } from "./tracker.engine.js";

export interface EngineRuntime {
  artifacts: LoadedArtifacts;
  trackers: TrackerEngine;
  allowlist: AllowlistEngine;
  providers: ProviderEngine;
  blocklist: BlocklistEngine;
  orchestrator: CleanerOrchestrator;
}

let cached: EngineRuntime | undefined;

const createRuntime = (dir?: string): EngineRuntime => {
  const artifacts = loadCompiledArtifacts(dir);

  setLogVersions(
    artifacts.manifest.artifactVersion,
    artifacts.manifest.validatorVersion
  );

  if (!artifacts.artifactHashValid) {
    logWarn("artifact_hash_mismatch", {
      detail:
        "combined artifact hash mismatch; per-file JSON hashes passed, blocklist use may be degraded",
      errorCode: "artifact_hash_mismatch",
    });
  }

  const blocklist = loadBlocklistEngine(
    artifacts.dir,
    artifacts.manifest,
    { verifyHash: !artifacts.artifactHashValid }
  );
  const trackers = new TrackerEngine(artifacts.trackers.groups);
  const allowlist = new AllowlistEngine(artifacts.allowlist);
  const providers = new ProviderEngine(artifacts.providers);
  const orchestrator = new CleanerOrchestrator(
    trackers,
    allowlist,
    providers,
    artifacts.policy
  );

  return {
    artifacts,
    trackers,
    allowlist,
    providers,
    blocklist,
    orchestrator,
  };
};

export const getEngineRuntime = (): EngineRuntime => {
  if (cached !== undefined) {
    return cached;
  }

  cached = createRuntime();

  return cached;
};

export const initializeEngines = (): EngineRuntime => {
  const runtime = getEngineRuntime();
  const state = runtime.blocklist.getState();

  logInfo("config_loaded", {
    artifactVersion: runtime.artifacts.manifest.artifactVersion,
    providers: runtime.artifacts.manifest.counts.providers,
    hosts: runtime.artifacts.manifest.counts.uniqueHosts,
    blocklistStatus: state.status,
    ...(state.reason ? { blocklistReason: state.reason } : {}),
  });

  return runtime;
};
