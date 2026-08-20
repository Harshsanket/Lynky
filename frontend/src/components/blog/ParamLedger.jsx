/**
 * ParamLedger — table of the Amazon query parameters from the teardown, with
 * a plain-language description of what each one appears to carry.
 */

import { mono, body } from "../../lib/theme";

const PARAMS = [
  {
    name: "ref=sr_1_3",
    purpose:
      "Attribution indicating this product was reached from a particular search-result position.",
  },
  {
    name: "crid=4F9BF…",
    purpose: "An identifier associated with the search request that produced the result.",
  },
  {
    name: "dib=eyJ2…",
    purpose: "Encoded search or recommendation context used internally by Amazon.",
  },
  {
    name: "dib_tag=se",
    purpose: "A small flag associated with the encoded search context.",
  },
  {
    name: "keywords=iphone+17+pro+max",
    purpose: "The search phrase that led to the product.",
  },
  {
    name: "qid=1786806495",
    purpose: "An identifier associated with when the search request was produced.",
  },
  {
    name: "sprefix=…",
    purpose: "Autocomplete and search-scope state carried from the search page.",
  },
  {
    name: "sr=8-3",
    purpose: "Search-result positioning or ranking context.",
  },
  {
    name: "th=1",
    purpose: "Interface or variant state. It is not needed to identify the product.",
  },
];

export default function ParamLedger() {
  return (
    <div
      className="border"
      style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-alt)" }}
    >
      <div className="grid px-4 py-3 sm:grid-cols-[170px_1fr]" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <span className="text-[9px] uppercase tracking-[0.16em]" style={{ ...mono, color: "var(--color-ink-soft)" }}>
          parameter
        </span>

        <span className="hidden text-[9px] uppercase tracking-[0.16em] sm:block" style={{ ...mono, color: "var(--color-ink-soft)" }}>
          what it appears to carry
        </span>
      </div>

      {PARAMS.map((param) => (
        <div
          key={param.name}
          className="grid border-t first:border-t-0 sm:grid-cols-[170px_1fr]"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="px-4 py-4 sm:border-r" style={{ borderColor: "var(--color-border)" }}>
            <code className="break-all text-xs" style={{ ...mono, color: "var(--color-dirty)" }}>
              {param.name}
            </code>
          </div>

          <p className="px-4 pb-4 text-xs leading-relaxed sm:py-4 sm:text-sm" style={{ ...body, color: "var(--color-ink-soft)" }}>
            {param.purpose}
          </p>
        </div>
      ))}
    </div>
  );
}