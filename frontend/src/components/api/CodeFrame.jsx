/**
 * CodeFrame — request/response code block with a labelled header
 * (POST /api/v1/urls).
 */

import { mono } from "../../lib/theme";

export default function CodeFrame() {
  return (
    <div
      className="overflow-hidden border"
      style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-alt)" }}
    >
      <div
        className="flex items-center justify-between gap-4 border-b px-5 py-3"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="flex items-center gap-3">
          <span className="text-[9px] uppercase tracking-[0.16em]" style={{ ...mono, color: "var(--color-dirty)" }}>
            POST
          </span>

          <span className="text-[10px]" style={{ ...mono, color: "var(--color-ink)" }}>
            /api/v1/urls
          </span>
        </div>

        <span className="hidden text-[9px] uppercase tracking-[0.14em] sm:block" style={{ ...mono, color: "var(--color-ink-soft)" }}>
          authenticated
        </span>
      </div>

      <div className="grid sm:grid-cols-[92px_1fr]">
        <div
          className="border-b px-5 py-4 sm:border-b-0 sm:border-r"
          style={{ borderColor: "var(--color-border)" }}
        >
          <span className="text-[9px] uppercase tracking-[0.13em]" style={{ ...mono, color: "var(--color-ink-soft)" }}>
            request
          </span>
        </div>

        <pre className="overflow-x-auto px-5 py-5 text-xs leading-[1.8]" style={{ ...mono, color: "var(--color-ink)" }}>
{`Authorization: Bearer <your-api-secret>
Content-Type: application/json

{
  "url": "https://example.com/?utm_source=x"
}`}
        </pre>
      </div>

      <div className="grid border-t sm:grid-cols-[92px_1fr]" style={{ borderColor: "var(--color-border)" }}>
        <div
          className="border-b px-5 py-4 sm:border-b-0 sm:border-r"
          style={{ borderColor: "var(--color-border)" }}
        >
          <span className="text-[9px] uppercase tracking-[0.13em]" style={{ ...mono, color: "var(--color-clean)" }}>
            response
          </span>
        </div>

        <pre className="overflow-x-auto px-5 py-5 text-xs leading-[1.8]" style={{ ...mono, color: "var(--color-clean)" }}>
{`{
  "success": true,
  "shortUrl": "https://short-lnky-hs.vercel.app/abc1"
}`}
        </pre>
      </div>
    </div>
  );
}