/**
 * BoundaryFigure — "what Lynky can / cannot remove" comparison card.
 */

import { mono, display, body } from "../../lib/theme";

export default function BoundaryFigure() {
  return (
    <div
      className="grid border sm:grid-cols-2"
      style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-alt)" }}
    >
      <div
        className="border-b p-5 sm:border-b-0 sm:border-r sm:p-6"
        style={{ borderColor: "var(--color-border)" }}
      >
        <span className="text-[10px] uppercase tracking-[0.14em]" style={{ ...mono, color: "var(--color-clean)" }}>
          in the address
        </span>

        <h3 className="mt-4 text-base" style={{ ...display, color: "var(--color-ink)", fontWeight: 500 }}>
          Lynky can remove this.
        </h3>

        <p className="mt-3 text-sm leading-relaxed" style={{ ...body, color: "var(--color-ink-soft)" }}>
          Known tracking parameters, click identifiers, attribution data, unnecessary query values
          and URL-level noise covered by the cleaning rules.
        </p>
      </div>

      <div className="p-5 sm:p-6">
        <span className="text-[10px] uppercase tracking-[0.14em]" style={{ ...mono, color: "var(--color-dirty)" }}>
          after the request
        </span>

        <h3 className="mt-4 text-base" style={{ ...display, color: "var(--color-ink)", fontWeight: 500 }}>
          Lynky cannot remove this.
        </h3>

        <p className="mt-3 text-sm leading-relaxed" style={{ ...body, color: "var(--color-ink-soft)" }}>
          Destination-server logs, first-party cookies, account activity, browser fingerprinting or
          information collected after the page has loaded.
        </p>
      </div>
    </div>
  );
}