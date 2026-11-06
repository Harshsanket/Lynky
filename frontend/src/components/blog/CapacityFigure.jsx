/**
 * CapacityFigure — the 5k/hour request budget and the protective layers around
 * the origin.
 */

import { mono, body } from "../../lib/theme";
import FigureFrame from "./FigureFrame";

const LAYERS = [
  ["edge cache", "status / stats / not-found"],
  ["firewall + BotID", "pre-application filtering"],
  ["global budget", "5,000 requests / hour"],
  ["route limiters", "create + usage reads"],
  ["origin", "Mongo / Redis / redirect"],
];

export default function CapacityFigure() {
  return (
    <FigureFrame
      index="08"
      title="A request budget with protective layers."
      note="capacity"
    >
      <div className="overflow-x-auto px-5 py-8 sm:px-6">
        <div className="flex min-w-155 items-start">
          {LAYERS.map(([label, note], index) => (
            <div key={label} className="flex min-w-0 flex-1 items-start">
              <div className="min-w-0 flex-1 text-center">
                <span
                  className="mx-auto flex h-8 w-8 items-center justify-center border text-[9px]"
                  style={{
                    ...mono,
                    borderColor: index === 2 ? "var(--color-clean)" : "var(--color-border)",
                    color: index === 2 ? "var(--color-clean)" : "var(--color-ink)",
                  }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="mt-3 text-xs" style={{ ...mono, color: "var(--color-ink)" }}>
                  {label}
                </p>
                <p className="mt-1 text-[10px] leading-relaxed" style={{ ...body, color: "var(--color-ink-soft)" }}>
                  {note}
                </p>
              </div>
              {index < LAYERS.length - 1 && (
                <span className="mt-3 px-1 text-xs" style={{ ...mono, color: "var(--color-border)" }}>
                  →
                </span>
              )}
            </div>
          ))}
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
        Local benchmark context is not a platform capacity guarantee. The tiny
        Redis/Mongo budgets shape the caching and aggregation choices.
      </div>
    </FigureFrame>
  );
}
