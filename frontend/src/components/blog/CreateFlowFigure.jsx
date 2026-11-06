/**
 * CreateFlowFigure — clean URL → dedupe hash + salt → derived code → stored
 * hashes/ciphertext, with the repeat-shorten branch.
 */

import { mono, body } from "../../lib/theme";
import FigureFrame from "./FigureFrame";

const STEPS = [
  ["clean", "destination after rules"],
  ["urlHash", "keyed dedupe key"],
  ["codeSalt", "16 random bytes"],
  ["code", "derived from both"],
  ["codeHash", "keyed lookup value"],
  ["store", "ciphertext + hashes"],
];

export default function CreateFlowFigure() {
  return (
    <FigureFrame
      index="06"
      title="The clean URL becomes a recoverable code."
      note="create / repeat"
    >
      <div className="overflow-x-auto px-5 py-8 sm:px-6">
        <div className="flex min-w-160 items-start">
          {STEPS.map(([label, note], index) => (
            <div key={label} className="flex min-w-0 flex-1 items-start">
              <div className="min-w-0 flex-1 text-center">
                <span
                  className="mx-auto flex h-8 w-8 items-center justify-center border text-[9px]"
                  style={{
                    ...mono,
                    borderColor: index === 5 ? "var(--color-clean)" : "var(--color-border)",
                    color: index === 5 ? "var(--color-clean)" : "var(--color-ink)",
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
              {index < STEPS.length - 1 && (
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
        Repeat shorten: same urlHash + stored codeSalt → same code. Expired or
        deleted row → new salt → new code.
      </div>
    </FigureFrame>
  );
}
