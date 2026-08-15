export default function NotFound() {
  return (
    <div className="flex  flex-col bg-bg font-body text-ink">
      <div className="paper-grain pointer-events-none fixed inset-0" />

      <div className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 sm:px-8">

        {/* Body */}
        <main className="flex flex-1 flex-col items-start justify-center gap-6 py-12">
          <span className="font-mono text-sm text-dirty">404 / not found</span>

          <h1 className="font-display text-4xl font-medium leading-[1.1] sm:text-5xl">
            This link went missing.
          </h1>

          <p className="max-w-md text-base leading-relaxed text-ink-soft sm:text-lg">
            Either it never existed, or it got cleaned a little too well.
            Let's get you back to somewhere real.
          </p>

          <div className="w-full max-w-md rounded-lg border border-border bg-bg-alt">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <span
          className="h-2.5 w-2.5 rounded-full"
          style={{
            backgroundColor: "var(--color-dirty)",
            opacity: 0.5,
          }}
        />

        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{
            backgroundColor: "var(--color-ink-soft)",
            opacity: 0.3,
          }}
        />

        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{
            backgroundColor: "var(--color-clean)",
            opacity: 0.5,
          }}
        />

        <span
          className=" text-xs "
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-ink-soft)",
          }}
        />
              <span className="font-mono text-xs tracking-wide text-ink-soft">
                what you asked for
              </span>
            </div>

            <div className="px-4 py-4">
              <p className="break-all font-mono text-sm text-dirty line-through decoration-1">
                lynky.to{typeof window !== "undefined" ? window.location.pathname : "/whatever-you-typed"}
              </p>
            </div>
          </div>

          <a
            href="/"
            className="mt-2 underline rounded-md bg-ink px-5 py-3 text-sm font-medium text-bg-alt transition-opacity hover:opacity-90"
          >
            <b>Back to lynky</b>
          </a>
        </main>

      </div>
    </div>
  );
}