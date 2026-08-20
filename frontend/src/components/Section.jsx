/**
 * Shared editorial section used by the About, API and Blog pages.
 *
 * Lays out a section as a two-column grid (number/mark on the left, content
 * on the right) with a divider on top — the site's consistent "document"
 * rhythm. `id` is optional and used by the Blog's anchor links.
 */

import { mono, display, body } from "../lib/theme";

export default function Section({ id, mark, eyebrow, title, children }) {
  return (
    <section
      id={id}
      className="
        grid grid-cols-1
        scroll-mt-24
        border-t py-14
        sm:grid-cols-[118px_minmax(0,1fr)]
        sm:gap-10 sm:py-16
      "
      style={{ borderColor: "var(--color-border)" }}
    >
      <aside className="mb-6 sm:mb-0">
        <div className="sm:sticky sm:top-24">
          <span
            className="block text-[10px] uppercase tracking-[0.16em]"
            style={{ ...mono, color: "var(--color-dirty)" }}
          >
            {mark}
          </span>

          {eyebrow && (
            <span
              className="mt-2 hidden max-w-25 text-[9px] uppercase leading-relaxed tracking-widest sm:block"
              style={{ ...mono, color: "var(--color-ink-soft)" }}
            >
              {eyebrow}
            </span>
          )}
        </div>
      </aside>

      <div className="min-w-0">
        <h2
          className="max-w-2xl text-[1.7rem] leading-[1.12] sm:text-[2rem]"
          style={{ ...display, color: "var(--color-ink)", fontWeight: 500 }}
        >
          {title}
        </h2>

        <div
          className="
            mt-6 flex max-w-2xl flex-col gap-5
            text-[15px] leading-[1.75]
            sm:text-base
          "
          style={{ ...body, color: "var(--color-ink-soft)" }}
        >
          {children}
        </div>
      </div>
    </section>
  );
}