/**
 * CleanResult — highlighted "clean destination" card shown after the teardown.
 */

import { mono } from "../../lib/theme";

export default function CleanResult() {
  return (
    <div
      className="border"
      style={{ borderColor: "var(--color-clean)", backgroundColor: "var(--color-clean-soft)" }}
    >
      <div
        className="flex items-center justify-between gap-5 border-b px-5 py-3"
        style={{ borderColor: "color-mix(in srgb, var(--color-clean) 30%, transparent)" }}
      >
        <span className="text-[9px] uppercase tracking-[0.18em]" style={{ ...mono, color: "var(--color-clean)" }}>
          clean destination
        </span>

        <span className="text-[9px]" style={{ ...mono, color: "var(--color-clean)" }}>
          ✓
        </span>
      </div>

      <p className="break-all px-5 py-6 text-sm sm:text-base" style={{ ...mono, color: "var(--color-clean)" }}>
        https://www.amazon.in/dp/B0FQFW4MVJ
      </p>
    </div>
  );
}