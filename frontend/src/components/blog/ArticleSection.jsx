/**
 * ArticleSection — Blog-only article layout.
 *
 * Order: mark/eyebrow, title, figure, prose, supporting cards/examples.
 * The rest of the site keeps the shared left-rail `Section` layout.
 */

import { mono, display, body } from "../../lib/theme";

export default function ArticleSection({
  id,
  mark,
  eyebrow,
  title,
  figure,
  children,
}) {
  return (
    <section
      id={id}
      className="scroll-mt-32 border-t py-14 sm:py-16"
      style={{ borderColor: "var(--color-border)" }}
    >
      <div className="mx-auto w-full max-w-3xl">
        <div
          className="sticky top-20 z-20 -mx-2 bg-(--color-bg) px-2 pb-2 pt-0"
        >
          <div className="flex items-center gap-3">
            <span
              className="text-[10px] uppercase tracking-[0.2em]"
              style={{ ...mono, color: "var(--color-dirty)" }}
            >
              {mark}
            </span>

            {eyebrow && (
              <>
                <span
                  className="h-px w-8"
                  style={{ backgroundColor: "var(--color-border)" }}
                />
                <span
                  className="text-[10px]"
                  style={{ ...mono, color: "var(--color-ink-soft)" }}
                >
                  {eyebrow}
                </span>
              </>
            )}
          </div>
        </div>

        <h2
          className="mt-6 max-w-2xl text-[1.7rem] leading-[1.12] sm:text-[2rem]"
          style={{ ...display, color: "var(--color-ink)", fontWeight: 500 }}
        >
          {title}
        </h2>

        {figure && <div className="mt-8">{figure}</div>}

        <div
          className="mt-6 flex flex-col gap-5 text-[15px] leading-[1.75] sm:text-base"
          style={{ ...body, color: "var(--color-ink-soft)" }}
        >
          {children}
        </div>
      </div>
    </section>
  );
}
