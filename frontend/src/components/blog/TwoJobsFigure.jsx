/**
 * TwoJobsFigure — side-by-side "clean then shorten" demo for the Blog.
 */

import { mono } from "../../lib/theme";
import FigureFrame from "./FigureFrame";

export default function TwoJobsFigure() {
  return (
    <FigureFrame
      index="02"
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
            amazon.in/dp/B0FQFW4MVJ?crid=…&dib=…&qid=…&sr=8-3
          </p>

          <div className="my-5 h-px" style={{ backgroundColor: "var(--color-border)" }} />

          <p className="break-all text-sm" style={{ ...mono, color: "var(--color-clean)" }}>
            amazon.in/dp/B0FQFW4MVJ
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <span
            className="text-[9px] uppercase tracking-[0.18em]"
            style={{ ...mono, color: "var(--color-clean)" }}
          >
            02 / shorten
          </span>

          <p className="mt-5 break-all text-sm" style={{ ...mono, color: "var(--color-clean)" }}>
            amazon.in/dp/B0FQFW4MVJ
          </p>

          <div className="my-5 h-px" style={{ backgroundColor: "var(--color-border)" }} />

          <p className="text-lg" style={{ ...mono, color: "var(--color-ink)", fontWeight: 600 }}>
            short-lynky-hs.vercel.app/demo
          </p>
        </div>
      </div>
    </FigureFrame>
  );
}