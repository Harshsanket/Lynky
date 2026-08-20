/**
 * FigureFrame — bordered "figure" container used for the Blog's diagrams.
 * Shows a labelled header (Fig. index / title / optional note) and a grid
 * backdrop behind the diagram content.
 */

import { mono, display } from "../../lib/theme";

export default function FigureFrame({ index, title, note, children }) {
  return (
    <figure
      className="relative overflow-hidden border"
      style={{
        borderColor: "var(--color-border)",
        backgroundColor: "var(--color-bg-alt)",
      }}
    >
      {/* faint grid backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `
            linear-gradient(var(--color-ink) 1px, transparent 1px),
            linear-gradient(90deg, var(--color-ink) 1px, transparent 1px)
          `,
          backgroundSize: "20px 20px",
        }}
      />

      <header
        className="relative flex items-start justify-between gap-6 border-b px-5 py-4 sm:px-6"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div>
          <span
            className="text-[9px] uppercase tracking-[0.2em]"
            style={{ ...mono, color: "var(--color-ink-soft)" }}
          >
            Fig. {index}
          </span>

          <h3
            className="mt-1 text-base sm:text-lg"
            style={{ ...display, color: "var(--color-ink)", fontWeight: 500 }}
          >
            {title}
          </h3>
        </div>

        {note && (
          <span
            className="hidden text-right text-[9px] uppercase leading-relaxed tracking-[0.14em] sm:block"
            style={{ ...mono, color: "var(--color-ink-soft)" }}
          >
            {note}
          </span>
        )}
      </header>

      <div className="relative">{children}</div>
    </figure>
  );
}