const SECTIONS = [
  {
    mark: "01 / tracking params",
    title: "Every link is a return address",
    body: "utm_source, fbclid, gclid — parameters like these tie a click back to the exact post, email, or person that sent it. Ad platforms and analytics tools use them to build a trail of what you read, and who you shared it with.",
  },
  {
    mark: "02 / cookies & headers",
    title: "It's not just the URL",
    body: "Some links carry more than parameters. A tracking cookie can be dropped the moment a link opens, and a bad redirect page can read referrer or user-agent headers before you ever land on the real site.",
  },
  {
    mark: "03 / preview leaks",
    title: "Even a preview can tell on you",
    body: "Paste a raw link into a chat app and it often fetches a preview automatically — pulling the page's metadata, and sometimes firing whatever tracker sits on it, before anyone has actually clicked.",
  },
  {
    mark: "04 / shorter is safer",
    title: "A smaller trail, a smaller mess",
    body: "A clean short link hides the destination and drops the trailing parameters entirely. It's a smaller attack surface — and it doesn't ruin the vibe of a text thread with three lines of query string.",
  },
];

const Privacy = () => {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-14 sm:px-8">
      <div className="flex flex-col gap-4">
        <span
          className="text-xs uppercase tracking-widest"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-soft)" }}
        >
          privacy
        </span>

        <h1
          className="text-3xl leading-[1.1] sm:text-4xl"
          style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
        >
          Links can spy on you too.
        </h1>

        <p
          className="max-w-xl text-base leading-relaxed sm:text-lg"
          style={{ fontFamily: "var(--font-body)", color: "var(--color-ink-soft)" }}
        >
          Most people worry about apps and cookies. Fewer notice that the
          link itself — the one they paste into a message — is already
          carrying a small profile of them along for the ride.
        </p>
      </div>

      <div className="flex flex-col divide-y" style={{ borderColor: "var(--color-border)" }}>
        {SECTIONS.map((section) => (
          <div
            key={section.mark}
            className="grid grid-cols-1 gap-2 border-t py-8 first:border-t-0 first:pt-0 sm:grid-cols-[140px_1fr] sm:gap-8"
            style={{ borderColor: "var(--color-border)" }}
          >
            <span
              className="text-sm"
              style={{ fontFamily: "var(--font-mono)", color: "var(--color-dirty)" }}
            >
              {section.mark}
            </span>

            <div className="flex flex-col gap-2">
              <h2
                className="text-lg"
                style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
              >
                {section.title}
              </h2>
              <p
                className="text-sm leading-relaxed sm:text-base"
                style={{ fontFamily: "var(--font-body)", color: "var(--color-ink-soft)" }}
              >
                {section.body}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div
        className="rounded-lg border px-5 py-5"
        style={{ borderColor: "var(--color-clean)", backgroundColor: "var(--color-clean-soft)" }}
      >
        <p
          className="text-sm leading-relaxed sm:text-base"
          style={{ fontFamily: "var(--font-body)", color: "var(--color-clean)" }}
        >
          Lynky strips known tracking parameters before shortening, doesn't
          drop its own cookies, and doesn't log where a link ends up going.
          It cleans the link and gets out of the way.
        </p>
      </div>
    </main>
  );
};

export default Privacy;