/**
 * ThanksRow — a single "thanks" entry in the acknowledgements list. Renders
 * as an external link when a URL is present, otherwise as a plain row.
 */

import { mono, body } from "../../lib/theme";

export default function ThanksRow({ index, name, role, note, url }) {
  const content = (
    <>
      <div>
        <span className="text-[9px]" style={{ ...mono, color: "var(--color-ink-soft)" }}>
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>

      <div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-sm" style={{ ...body, color: "var(--color-ink)", fontWeight: 600 }}>
            {name}
          </span>

          <span className="text-[9px] uppercase tracking-[0.13em]" style={{ ...mono, color: "var(--color-dirty)" }}>
            {role}
          </span>
        </div>

        <p className="mt-2 max-w-xl text-sm leading-relaxed" style={{ ...body, color: "var(--color-ink-soft)" }}>
          {note}
        </p>
      </div>

      {url && (
        <div className="hidden text-xs sm:block" style={{ ...mono, color: "var(--color-ink-soft)" }}>
          ↗
        </div>
      )}
    </>
  );

  const className = "grid border-t py-5 first:border-t-0 sm:grid-cols-[42px_1fr_auto] sm:gap-4";

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={className}
        style={{ borderColor: "var(--color-border)" }}
      >
        {content}
      </a>
    );
  }

  return (
    <div className={className} style={{ borderColor: "var(--color-border)" }}>
      {content}
    </div>
  );
}