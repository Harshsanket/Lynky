/**
 * RedirectCacheFigure — layered redirect path from browser/CDN through local
 * negative cache, Redis hot cache, Mongo cold read, and click accounting.
 */

import { mono, body } from "../../lib/theme";
import FigureFrame from "./FigureFrame";

const LAYERS = [
  ["browser / CDN", "cached not-found or redirect response"],
  ["local negative", "bounded 30s false-code memory"],
  ["Redis hot", "link + hot state, 15m sliding TTL"],
  ["Mongo cold", "durable link row + decrypt"],
  ["302", "successful redirect, no-store"],
];

export default function RedirectCacheFigure() {
  return (
    <FigureFrame
      index="07"
      title="The redirect path tries the cheapest layer first."
      note="hot / cold"
    >
      <div className="grid gap-px sm:grid-cols-5" style={{ backgroundColor: "var(--color-border)" }}>
        {LAYERS.map(([label, note], index) => (
          <div key={label} className="bg-(--color-bg-alt) p-4 sm:p-5">
            <span className="text-[9px]" style={{ ...mono, color: "var(--color-dirty)" }}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <p className="mt-2 text-xs" style={{ ...mono, color: "var(--color-ink)" }}>
              {label}
            </p>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ ...body, color: "var(--color-ink-soft)" }}>
              {note}
            </p>
          </div>
        ))}
      </div>

      <div
        className="border-t px-5 py-4 text-[10px] leading-relaxed"
        style={{
          borderColor: "var(--color-border)",
          ...mono,
          color: "var(--color-ink-soft)",
        }}
      >
        Click accounting runs beside the path. A newly created code clears its
        local negative marker immediately.
      </div>
    </FigureFrame>
  );
}
