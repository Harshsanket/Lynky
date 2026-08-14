const API = () => {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-center justify-center px-6 text-center sm:px-8">
      <span
        className="mb-4 text-xs uppercase tracking-widest"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-soft)" }}
      >
        API
      </span>

      <h1
        className="text-3xl sm:text-4xl"
        style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
      >
        Coming soon.
      </h1>

      <p
        className="mt-3 max-w-sm text-sm leading-relaxed sm:text-base"
        style={{ fontFamily: "var(--font-body)", color: "var(--color-ink-soft)" }}
      >
        We're still writing this one. Check back once new Lynky beta is live.
      </p>
      <a
            href="/"
            className="mt-2 underline rounded-md bg-ink px-5 py-3 text-sm font-medium text-bg-alt transition-opacity hover:opacity-90"
          >
            <b>Back to lynky</b>
          </a>
    </main>
  );
};

export default API;