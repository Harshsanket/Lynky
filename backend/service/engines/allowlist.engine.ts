import type { AllowlistArtifact } from "../../src/config/artifact-types.js";

/**
 * Global allowlist plus exact-or-parent-suffix domain entries. The per-host
 * set is built once and cached for the lifetime of the process; config is
 * static until restart.
 */
export class AllowlistEngine {
  readonly global: Set<string>;
  readonly domains: Map<string, Set<string>>;
  readonly exceptions: Map<string, Set<string>>;
  readonly protectedAllHosts: Set<string>;

  constructor(artifact: AllowlistArtifact) {
    this.global = new Set(artifact.global);
    this.domains = new Map(
      Object.entries(artifact.domains).map(([domain, parameters]) => [
        domain,
        new Set(parameters),
      ])
    );
    this.protectedAllHosts = new Set();
    this.exceptions = new Map();

    for (const [domain, parameters] of Object.entries(
      artifact.exceptions
    )) {
      const protectedKeys = new Set<string>();

      for (const parameter of parameters) {
        if (parameter === "*") {
          this.protectedAllHosts.add(domain);
        } else {
          protectedKeys.add(parameter);
        }
      }

      if (protectedKeys.size > 0) {
        this.exceptions.set(domain, protectedKeys);
      }
    }
  }

  private suffixes(hostname: string): string[] {
    const host = hostname.toLowerCase().replace(/\.$/, "");
    const labels = host.split(".");
    const suffixes: string[] = [];

    for (let index = 0; index < labels.length; index++) {
      suffixes.push(labels.slice(index).join("."));
    }

    return suffixes;
  }

  forHost(hostname: string): Set<string> {
    const allowed = new Set(this.global);

    for (const suffix of this.suffixes(hostname)) {
      const parameters = this.domains.get(suffix);

      if (parameters) {
        for (const parameter of parameters) {
          allowed.add(parameter);
        }
      }

      const exceptionKeys = this.exceptions.get(suffix);

      if (exceptionKeys) {
        for (const parameter of exceptionKeys) {
          allowed.add(parameter);
        }
      }
    }

    return allowed;
  }

  protectsAll(hostname: string): boolean {
    return this.suffixes(hostname).some((suffix) =>
      this.protectedAllHosts.has(suffix)
    );
  }

  isAllowed(hostname: string, parameter: string): boolean {
    return (
      this.protectsAll(hostname) ||
      this.forHost(hostname).has(parameter)
    );
  }
}
