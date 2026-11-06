/**
 * ArchitectureFigure — Blog figure for Lynky's own policy layer: custom
 * tracker rules, ClearURLs global rules, allowlist, cleaner policy, and the
 * compiled blocklist feeding the cleaner/validator.
 */

import { mono, body } from "../../lib/theme";
import FigureFrame from "./FigureFrame";

const INPUTS = [
  ["lynky tracker rules", "custom exact / prefix / pattern policy"],
  ["ClearURLs global rules", "community tracker/provider data"],
  ["allowlist policy", "functional parameters that survive"],
  ["cleaner policy", "depth, wrappers, fragments"],
  ["compiled blocklists", "host suffix + exact URL screening"],
];

export default function ArchitectureFigure() {
  return (
    <FigureFrame
      index="09"
      title="The policy layer is Lynky's own."
      note="inputs → decisions"
    >
      <div className="grid gap-px sm:grid-cols-2" style={{ backgroundColor: "var(--color-border)" }}>
        <div className="bg-(--color-bg-alt) p-5 sm:p-6">
          <span
            className="text-[9px] uppercase tracking-[0.18em]"
            style={{ ...mono, color: "var(--color-clean)" }}
          >
            policy inputs
          </span>

          <div className="mt-4 flex flex-col gap-3">
            {INPUTS.map(([label, note]) => (
              <div key={label}>
                <p className="text-xs" style={{ ...mono, color: "var(--color-ink)" }}>
                  {label}
                </p>
                <p
                  className="mt-1 text-[10px] leading-relaxed"
                  style={{ ...body, color: "var(--color-ink-soft)" }}
                >
                  {note}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-(--color-bg-alt) p-5 sm:p-6">
          <span
            className="text-[9px] uppercase tracking-[0.18em]"
            style={{ ...mono, color: "var(--color-dirty)" }}
          >
            decision layer
          </span>

          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm" style={{ ...mono, color: "var(--color-ink)" }}>
                host validator
              </p>
              <p
                className="mt-1 text-xs leading-relaxed"
                style={{ ...body, color: "var(--color-ink-soft)" }}
              >
                shape, credentials, private ranges, internal names, IDN policy,
                and blocklist screening before creation.
              </p>
            </div>

            <div>
              <p className="text-sm" style={{ ...mono, color: "var(--color-ink)" }}>
                cleaner orchestrator
              </p>
              <p
                className="mt-1 text-xs leading-relaxed"
                style={{ ...body, color: "var(--color-ink-soft)" }}
              >
                provider candidates, wrapper unwrap, rules, referral rules, raw
                rules, tracker groups, then the allowlist overlay.
              </p>
            </div>

            <div>
              <p className="text-sm" style={{ ...mono, color: "var(--color-clean)" }}>
                result
              </p>
              <p
                className="mt-1 text-xs leading-relaxed"
                style={{ ...body, color: "var(--color-ink-soft)" }}
              >
                a clean destination that is safe to hash, encrypt, and shorten.
              </p>
            </div>
          </div>
        </div>
      </div>
    </FigureFrame>
  );
}
