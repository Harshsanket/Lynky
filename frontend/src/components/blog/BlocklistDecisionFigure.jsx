/**
 * BlocklistDecisionFigure — MPHF primary index with a sorted-hash fallback
 * and an exact collision check. Conceptual, not a byte-level diagram.
 */

import { mono, body } from "../../lib/theme";
import FigureFrame from "./FigureFrame";

export default function BlocklistDecisionFigure() {
  return (
    <FigureFrame
      index="02"
      title="A deterministic blocklist index, not a probabilistic guess."
      note="lookup"
    >
      <div className="grid gap-px sm:grid-cols-2" style={{ backgroundColor: "var(--color-border)" }}>
        <div className="bg-(--color-bg-alt) p-5 sm:p-6">
          <span
            className="text-[9px] uppercase tracking-[0.18em]"
            style={{ ...mono, color: "var(--color-clean)" }}
          >
            primary / MPHF
          </span>

          <p className="mt-4 text-xs leading-relaxed" style={{ ...body, color: "var(--color-ink-soft)" }}>
            host → parent-suffix walk → MPHF slot → 64-bit verification →
            collision check → block or allow.
          </p>

          <p className="mt-3 text-[10px] leading-relaxed" style={{ ...mono, color: "var(--color-ink-soft)" }}>
            no Bloom filter; false positives are not acceptable for blocking.
          </p>
        </div>

        <div className="bg-(--color-bg-alt) p-5 sm:p-6">
          <span
            className="text-[9px] uppercase tracking-[0.18em]"
            style={{ ...mono, color: "var(--color-dirty)" }}
          >
            fallback / sorted hashes
          </span>

          <p className="mt-4 text-xs leading-relaxed" style={{ ...body, color: "var(--color-ink-soft)" }}>
            sorted 64-bit hashes → binary search → collision check. The compiler
            can emit this mode behind a flag if the MPHF build is unavailable.
          </p>

          <p className="mt-3 text-[10px] leading-relaxed" style={{ ...mono, color: "var(--color-ink-soft)" }}>
            exact URL keys stay in a separate set.
          </p>
        </div>
      </div>

      <div
        className="border-t px-5 py-4 text-[10px] leading-relaxed"
        style={{
          borderColor: "var(--color-border)",
          ...mono,
          color: "var(--color-ink-soft)",
        }}
      >
        Host suffix matching covers subdomains. Exact URL keys are checked
        separately. Build-time cost buys a small, fast runtime artifact.
      </div>
    </FigureFrame>
  );
}
