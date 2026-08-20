/**
 * RedirectChainDiagram — animated SVG showing the multi-hop journey of a
 * link (source → platform → redirect → destination).
 */

import { mono, body } from "../../lib/theme";
import FigureFrame from "./FigureFrame";

const NODES = [
  { label: "source", detail: "email / ad / post", color: "var(--color-clean)" },
  { label: "platform", detail: "adds attribution", color: "var(--color-dirty)" },
  { label: "redirect", detail: "another request", color: "var(--color-dirty)" },
  { label: "destination", detail: "page finally loads", color: "var(--color-ink)" },
];

export default function RedirectChainDiagram() {
  return (
    <FigureFrame
      index="01"
      title="The journey can be longer than the address suggests."
      note="request path"
    >
      <div className="overflow-x-auto px-5 py-8 sm:px-7">
        <svg viewBox="0 0 620 120" className="w-full min-w-130" aria-hidden="true">
          <line x1="60" y1="55" x2="560" y2="55" stroke="var(--color-border)" strokeWidth="1.5" />
          <line
            className="lynky-flow-line"
            x1="60"
            y1="55"
            x2="560"
            y2="55"
            stroke="var(--color-dirty)"
            strokeWidth="1.5"
            strokeDasharray="5 7"
          />

          {NODES.map((node, index) => {
            const x = 60 + index * (500 / 3);

            return (
              <g key={node.label}>
                <circle cx={x} cy="55" r="6" fill="var(--color-bg-alt)" stroke={node.color} strokeWidth="1.5" />
                <text x={x} y="27" textAnchor="middle" style={{ ...mono, fontSize: "10px", fill: "var(--color-ink)" }}>
                  {node.label}
                </text>
                <text x={x} y="82" textAnchor="middle" style={{ ...body, fontSize: "9px", fill: "var(--color-ink-soft)" }}>
                  {node.detail}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </FigureFrame>
  );
}