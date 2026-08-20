/**
 * ShortcutSetup — step-by-step guide for installing the Lynky iPhone
 * Shortcut.
 */

import { mono, body } from "../../lib/theme";

const SHORTCUT_STEPS = [
  {
    n: "01",
    title: "Add the Shortcut",
    text: (
      <>
        Tap{" "}
        <a
          href={import.meta.env.VITE_IOS_SHORTCUT}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4 transition-opacity hover:opacity-60"
          style={{ color: "var(--color-clean)" }}
        >
          get shortcut
        </a>{" "}
        on your iPhone and add it to Shortcuts.
      </>
    ),
  },
  {
    n: "02",
    title: "Tap Edit",
    text: (
      <>
        Open the Shortcut and tap <b style={{ color: "var(--color-ink)" }}>Edit</b>.
      </>
    ),
  },
  {
    n: "03",
    title: "Expand the request",
    text: (
      <>
        Find the <b style={{ color: "var(--color-ink)" }}>Get Contents of URL</b>{" "}
        action and tap the <b style={{ color: "var(--color-ink)" }}>›</b> button to expand it.
      </>
    ),
  },
  {
    n: "04",
    title: "Enter your API key",
    text: (
      <>
        Find the <b style={{ color: "var(--color-ink)" }}>Authorization</b> section and enter
        your Lynky API key. That is the only value you need to change.
      </>
    ),
  },
  {
    n: "05",
    title: "Allow link access",
    text: (
      <>
        The first time you run the Shortcut, iOS will ask for permission to access the link. Tap{" "}
        <b style={{ color: "var(--color-ink)" }}>Always Allow</b> so it can run without asking
        every time, or choose <b style={{ color: "var(--color-ink)" }}>Allow Once</b> if you
        prefer to approve it each time.
      </>
    ),
  },
  {
    n: "06",
    title: "That's it",
    text: (
      <>
        The Shortcut is ready. Run it whenever you want Lynky to clean and shorten a link.
      </>
    ),
  },
];

export default function ShortcutSetup() {
  return (
    <div
      className="border"
      style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-alt)" }}
    >
      <div
        className="flex flex-col gap-5 border-b px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div>
          <span
            className="text-[9px] uppercase tracking-[0.18em]"
            style={{ ...mono, color: "var(--color-clean)" }}
          >
            ios 27+
          </span>

          <p className="mt-2 text-sm" style={{ ...body, color: "var(--color-ink)", fontWeight: 600 }}>
            Start with the ready-made Lynky Shortcut.
          </p>
        </div>

        <a
          href={import.meta.env.VITE_IOS_SHORTCUT}
          target="_blank"
          rel="noreferrer"
          className="w-fit shrink-0 border px-4 py-2.5 text-xs transition-opacity hover:opacity-60"
          style={{ ...mono, borderColor: "var(--color-clean)", color: "var(--color-clean)" }}
        >
          get shortcut ↗
        </a>
      </div>

      {SHORTCUT_STEPS.map((step) => (
        <div
          key={step.n}
          className="grid border-t px-5 py-5 first:border-t-0 sm:grid-cols-[48px_170px_1fr] sm:gap-5 sm:px-6"
          style={{ borderColor: "var(--color-border)" }}
        >
          <span className="text-[10px]" style={{ ...mono, color: "var(--color-clean)" }}>
            {step.n}
          </span>

          <p className="mt-2 text-sm sm:mt-0" style={{ ...body, color: "var(--color-ink)", fontWeight: 600 }}>
            {step.title}
          </p>

          <p className="mt-2 text-sm leading-relaxed sm:mt-0" style={{ ...body, color: "var(--color-ink-soft)" }}>
            {step.text}
          </p>
        </div>
      ))}
    </div>
  );
}