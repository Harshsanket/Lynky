import type { AllowlistArtifact } from "../../src/config/artifact-types.js";

/**
 * Global allowlist plus exact-or-parent-suffix domain entries. The per-host
 * set is built once and cached for the lifetime of the process; config is
 * static until restart.
 */
export class AllowlistEngine {
  readonly global: Set<string>;
  readonly domains: Map<string, Set<string>>;

  constructor(artifact: AllowlistArtifact) {
    this.global = new Set(artifact.global);
    this.domains = new Map(
      Object.entries(artifact.domains).map(([domain, parameters]) => [
        domain,
        new Set(parameters),
      ])
    );
  }

  forHost(hostname: string): Set<string> {
    const host = hostname.toLowerCase().replace(/\.$/, "");
    const allowed = new Set(this.global);
    const labels = host.split(".");

    for (let index = 0; index < labels.length; index++) {
      const suffix = labels.slice(index).join(".");
      const parameters = this.domains.get(suffix);

      if (parameters) {
        for (const parameter of parameters) {
          allowed.add(parameter);
        }
      }
    }

    return allowed;
  }

  isAllowed(hostname: string, parameter: string): boolean {
    return this.forHost(hostname).has(parameter);
  }
}
