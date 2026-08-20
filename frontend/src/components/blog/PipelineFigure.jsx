/**
 * PipelineFigure — the 5-step Lynky pipeline (clean → code → encrypt →
 * store → expire) shown as a horizontal diagram.
 */

import { Fragment } from "react";
import { mono, body } from "../../lib/theme";
import FigureFrame from "./FigureFrame";

const NODES = [
  { n: "01", label: "clean", note: "rules remove known noise", tone: "dirty" },
  { n: "02", label: "code", note: "4–6 character identifier", tone: "neutral" },
  { n: "03", label: "encrypt", note: "AES-256-GCM", tone: "neutral" },
  { n: "04", label: "store", note: "temporary record", tone: "clean" },
  { n: "05", label: "expire", note: "deleted after 3 days", tone: "clean" },
];

const toneColor = (tone) => {
  if (tone === "dirty") return "var(--color-dirty)";
  if (tone === "clean") return "var(--color-clean)";
  return "var(--color-ink)";
};

export default function PipelineFigure() {
  return (
    <FigureFrame
      index="04"
      title="The short link is the end of a small pipeline."
      note="inside Lynky"
    >
      <div className="overflow-x-auto px-5 py-9 sm:px-6">
        <div className="flex min-w-150 items-stretch">
          {NODES.map((node, index) => {
            const color = toneColor(node.tone);

            return (
              <Fragment key={node.n}>
                <div className="w-26.25 shrink-0 text-center">
                  <span
                    className="mx-auto flex h-8 w-8 items-center justify-center border text-[9px]"
                    style={{ ...mono, borderColor: color, color }}
                  >
                    {node.n}
                  </span>

                  <p className="mt-3 text-xs" style={{ ...mono, color: "var(--color-ink)" }}>
                    {node.label}
                  </p>

                  <p className="mt-1 text-[10px] leading-relaxed" style={{ ...body, color: "var(--color-ink-soft)" }}>
                    {node.note}
                  </p>
                </div>

                {index < NODES.length - 1 && (
                  <div className="mt-4 flex min-w-5.5 flex-1 items-start">
                    <div className="h-px w-full" style={{ backgroundColor: "var(--color-border)" }} />
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      </div>
    </FigureFrame>
  );
}