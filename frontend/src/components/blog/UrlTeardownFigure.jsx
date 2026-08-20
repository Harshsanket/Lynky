/**
 * UrlTeardownFigure — interactive Amazon-link anatomy. Each URL fragment is a
 * button; selecting one highlights it and shows what it is for.
 */

import { useState } from "react";
import { mono, body } from "../../lib/theme";
import FigureFrame from "./FigureFrame";

/** Hard-coded EASE value so transitions match the site's motion language. */
const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

const URL_PARTS = [
  {
    id: "01",
    label: "protocol",
    value: "https://",
    tone: "neutral",
    note:
      "Defines how the browser communicates with the destination. It is structural, so Lynky leaves it alone.",
  },
  {
    id: "02",
    label: "host",
    value: "www.amazon.in",
    tone: "neutral",
    note: "The destination site. This identifies where the request ultimately goes.",
  },
  {
    id: "03",
    label: "product route",
    value: "/dp/B0FQFW4MVJ",
    tone: "clean",
    note: "The useful part. The ASIN identifies the exact Amazon product page.",
  },
  {
    id: "04",
    label: "attribution",
    value: "/ref=sr_1_3",
    tone: "dirty",
    note: "Describes where the product was encountered. The product page does not need this to resolve.",
  },
  {
    id: "05",
    label: "query string",
    value: "?crid=…&dib=…&keywords=…&qid=…&sprefix=…&sr=8-3&th=1",
    tone: "dirty",
    note: "Search, ranking and interface context appended to the useful destination.",
  },
];

const toneColor = (tone) => {
  if (tone === "clean") return "var(--color-clean)";
  if (tone === "dirty") return "var(--color-dirty)";
  return "var(--color-ink)";
};

export default function UrlTeardownFigure() {
  const [active, setActive] = useState(2);
  const part = URL_PARTS[active];

  return (
    <FigureFrame
      index="03"
      title="One link. Five different jobs."
      note="select a fragment"
    >
      <div className="px-5 py-8 sm:px-6 sm:py-10">
        <p className="break-all text-[13px] leading-[2.2] sm:text-[15px]" style={mono}>
          {URL_PARTS.map((item, index) => {
            const selected = index === active;
            const color = toneColor(item.tone);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(index)}
                className="inline border-b pb-1 text-left"
                style={{
                  color,
                  borderColor: selected ? color : "transparent",
                  opacity: selected ? 1 : 0.45,
                  transition: `opacity .3s ${EASE}, border-color .3s ${EASE}`,
                }}
              >
                {item.value}
              </button>
            );
          })}
        </p>
      </div>

      <div className="grid border-t sm:grid-cols-[80px_150px_1fr]" style={{ borderColor: "var(--color-border)" }}>
        <div className="border-b px-5 py-5 sm:border-b-0 sm:border-r" style={{ borderColor: "var(--color-border)" }}>
          <span className="text-xs" style={{ ...mono, color: toneColor(part.tone) }}>
            {part.id}
          </span>
        </div>

        <div className="border-b px-5 py-5 sm:border-b-0 sm:border-r" style={{ borderColor: "var(--color-border)" }}>
          <span className="text-[10px] uppercase tracking-[0.12em]" style={{ ...mono, color: "var(--color-ink)" }}>
            {part.label}
          </span>
        </div>

        <div className="px-5 py-5">
          <p className="text-sm leading-relaxed" style={{ ...body, color: "var(--color-ink-soft)" }}>
            {part.note}
          </p>
        </div>
      </div>
    </FigureFrame>
  );
}