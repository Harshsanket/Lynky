/**
 * TrailPoint — numbered card used in the "where the extra data comes from"
 * grid on the Blog.
 */

import { mono, body } from "../../lib/theme";

export default function TrailPoint({ number, title, children }) {
  return (
    <div className="bg-(--color-bg-alt) p-5 sm:p-6">
      <span
        className="text-[10px]"
        style={{ ...mono, color: "var(--color-dirty)" }}
      >
        {number}
      </span>

      <h3
        className="mt-3 text-sm"
        style={{ ...body, color: "var(--color-ink)", fontWeight: 600 }}
      >
        {title}
      </h3>

      <p
        className="mt-2 text-xs leading-relaxed sm:text-sm"
        style={{ ...body, color: "var(--color-ink-soft)" }}
      >
        {children}
      </p>
    </div>
  );
}