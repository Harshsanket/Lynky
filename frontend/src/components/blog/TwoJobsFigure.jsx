/**
 * TwoJobsFigure — side-by-side "clean then shorten" demo for the Blog.
 */

import { mono } from "../../lib/theme";
import { SHORT_URL } from "../../lib/config";
import FigureFrame from "./FigureFrame";

export default function TwoJobsFigure() {
  const shortHost = SHORT_URL.replace(/^https?:\/\//, "");

  return (
    <FigureFrame
      index="04"
      title="Remove first. Compress second."
      note="two operations"
    >
      <div className="grid sm:grid-cols-2">
        <div
          className="border-b p-5 sm:border-b-0 sm:border-r sm:p-6"
          style={{ borderColor: "var(--color-border)" }}
        >
          <span
            className="text-[9px] uppercase tracking-[0.18em]"
            style={{ ...mono, color: "var(--color-dirty)" }}
          >
            01 / clean
          </span>

          <p
            className="mt-5 break-all text-xs leading-relaxed"
            style={{ ...mono, color: "var(--color-dirty)" }}
          >
            example.com/products/42?utm_source=google&gclid=…&fbclid=…
          </p>

          <div className="my-5 h-px" style={{ backgroundColor: "var(--color-border)" }} />

          <p className="break-all text-sm" style={{ ...mono, color: "var(--color-clean)" }}>
            example.com/products/42
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <span
            className="text-[9px] uppercase tracking-[0.18em]"
            style={{ ...mono, color: "var(--color-clean)" }}
          >
            02 / shorten
          </span>

          <p
            className="mt-5 text-xs leading-relaxed"
            style={{ ...mono, color: "var(--color-ink-soft)" }}
          >
            clean destination → temporary code
          </p>

          <div className="my-5 h-px" style={{ backgroundColor: "var(--color-border)" }} />

          <p className="text-lg" style={{ ...mono, color: "var(--color-ink)", fontWeight: 600 }}>
            {shortHost}/demo
          </p>
        </div>
      </div>
    </FigureFrame>
  );
}