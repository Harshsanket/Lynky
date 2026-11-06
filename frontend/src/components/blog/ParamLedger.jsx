/**
 * ParamLedger — table of the query parameters from the teardown, with a
 * plain-language description of what each one appears to carry.
 */

import { mono, body } from "../../lib/theme";

const PARAMS = [
  {
    name: "utm_source=google",
    purpose: "Which site sent the visitor here.",
  },
  {
    name: "utm_medium=cpc",
    purpose: "The kind of channel that produced the visit — here, a paid click.",
  },
  {
    name: "utm_campaign=summer",
    purpose: "The marketing campaign name the sender assigned to this link.",
  },
  {
    name: "utm_content=cpc-banner",
    purpose: "Which creative or placement inside the campaign was clicked.",
  },
  {
    name: "gclid=Eh0iCj…",
    purpose: "Google Ads click identifier attached to the destination URL.",
  },
  {
    name: "fbclid=IwAR2…",
    purpose: "Meta (Facebook) click identifier attached to the destination URL.",
  },
  {
    name: "mc_cid=61d2e3",
    purpose: "Mailchimp campaign identifier for the email that shared this link.",
  },
  {
    name: "mc_eid=aa8f6f",
    purpose: "Per-recipient identifier for the specific email subscriber.",
  },
  {
    name: "ref=homepage",
    purpose: "A label for the page the visitor came from.",
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