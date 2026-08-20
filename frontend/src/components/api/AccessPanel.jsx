/**
 * AccessPanel — "access status" panel explaining that API secrets are issued
 * manually, with the current monthly quota.
 */

import { mono, display, body } from "../../lib/theme";

export default function AccessPanel() {
  return (
    <div
      className="border"
      style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-alt)" }}
    >
      <div className="border-b px-5 py-3" style={{ borderColor: "var(--color-border)" }}>
        <span className="text-[9px] uppercase tracking-[0.16em]" style={{ ...mono, color: "var(--color-ink-soft)" }}>
          access status
        </span>
      </div>

      <div className="grid sm:grid-cols-[1fr_auto]">
        <div className="p-5 sm:p-6">
          <span className="text-[10px] uppercase tracking-[0.14em]" style={{ ...mono, color: "var(--color-dirty)" }}>
            approval required
          </span>

          <h3 className="mt-4 text-lg" style={{ ...display, color: "var(--color-ink)", fontWeight: 500 }}>
            API secrets are issued manually.
          </h3>

          <p className="mt-3 max-w-md text-sm leading-relaxed" style={{ ...body, color: "var(--color-ink-soft)" }}>
            For now, request access directly by email. Once approved, your secret can be used from
            scripts, apps, or iPhone Shortcuts.
          </p>

          <a
            href="mailto:harshsanket.dev@gmail.com"
            className="mt-5 inline-block text-xs underline underline-offset-4"
            style={{ ...mono, color: "var(--color-clean)" }}
          >
            harshsanket.dev@gmail.com
          </a>
        </div>

        <div
          className="flex min-w-42.5 flex-col justify-between border-t p-5 sm:border-l sm:border-t-0"
          style={{ borderColor: "var(--color-border)" }}
        >
          <span className="text-[9px] uppercase tracking-[0.14em]" style={{ ...mono, color: "var(--color-ink-soft)" }}>
            monthly quota
          </span>

          <div className="mt-8">
            <span className="block text-3xl" style={{ ...display, color: "var(--color-ink)", fontWeight: 500 }}>
              10,000
            </span>

            <span className="mt-1 block text-[10px] uppercase tracking-[0.12em]" style={{ ...mono, color: "var(--color-ink-soft)" }}>
              links / month
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}