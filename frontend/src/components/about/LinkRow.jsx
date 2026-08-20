/**
 * LinkRow — external link row (github / project) used in the maker section.
 */

import { mono } from "../../lib/theme";

export default function LinkRow({ label, value, href }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group grid border-t py-4 first:border-t-0 sm:grid-cols-[120px_1fr_auto] sm:items-center"
      style={{ borderColor: "var(--color-border)" }}
    >
      <span className="text-[9px] uppercase tracking-[0.14em]" style={{ ...mono, color: "var(--color-ink-soft)" }}>
        {label}
      </span>

      <span className="mt-1 break-all text-sm sm:mt-0" style={{ ...mono, color: "var(--color-clean)" }}>
        {value}
      </span>

      <span
        className="mt-2 text-xs transition-transform group-hover:translate-x-1 sm:mt-0"
        style={{ ...mono, color: "var(--color-ink-soft)" }}
      >
        ↗
      </span>
    </a>
  );
}