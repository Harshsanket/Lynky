/**
 * DetailRow — one row in the API contract details table
 * (method / endpoint / auth / input / output / quota).
 */

import { mono, body } from "../../lib/theme";

export default function DetailRow({ label, value, note, tone = "neutral" }) {
  const color =
    tone === "clean"
      ? "var(--color-clean)"
      : tone === "dirty"
        ? "var(--color-dirty)"
        : "var(--color-ink)";

  return (
    <div
      className="grid border-t py-4 first:border-t-0 sm:grid-cols-[130px_150px_1fr] sm:items-baseline sm:gap-5"
      style={{ borderColor: "var(--color-border)" }}
    >
      <span className="text-[9px] uppercase tracking-[0.14em]" style={{ ...mono, color: "var(--color-ink-soft)" }}>
        {label}
      </span>

      <span className="mt-1 text-sm sm:mt-0" style={{ ...mono, color }}>
        {value}
      </span>

      <p className="mt-1 text-xs leading-relaxed sm:mt-0 sm:text-sm" style={{ ...body, color: "var(--color-ink-soft)" }}>
        {note}
      </p>
    </div>
  );
}