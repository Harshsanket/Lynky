/**
 * Principle — numbered principle card ("01 / Do one job", …).
 */

import { mono, display, body } from "../../lib/theme";

export default function Principle({ number, title, children }) {
  return (
    <div className="bg-(--color-bg-alt) p-5 sm:p-6">
      <span className="text-[9px]" style={{ ...mono, color: "var(--color-dirty)" }}>
        {number}
      </span>

      <h3 className="mt-4 text-base" style={{ ...display, color: "var(--color-ink)", fontWeight: 500 }}>
        {title}
      </h3>

      <p className="mt-3 text-sm leading-relaxed" style={{ ...body, color: "var(--color-ink-soft)" }}>
        {children}
      </p>
    </div>
  );
}