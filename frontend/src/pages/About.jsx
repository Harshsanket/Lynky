const THANKS = [
  {
    name: "Siddhesh Kumar",
    note: "software engineer, always there to help",
  },
  {
    name: "Kevin Roebert // ClearURLs",
    note: "Leader of ClearURLs Project",
  },
  {
    name: "Vercel",
    note: "hosting for both the frontend and the backend",
  },
  {
    name: "MongoDB",
    note: "hosting the database",
  },
  {
    name: "Claude & DeepSeek",
    note: "AI pair-programming along the way",
  },
];

const About = () => {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-14 sm:px-8">
      <div className="flex flex-col gap-4">
        <span
          className="text-xs uppercase tracking-widest"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-ink-soft)",
          }}
        >
          about
        </span>

        <h1
          className="text-3xl leading-[1.1] sm:text-4xl"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 500,
          }}
        >
          One person, one project.
        </h1>

        <p
          className="max-w-xl text-base leading-relaxed sm:text-lg"
          style={{
            fontFamily: "var(--font-body)",
            color: "var(--color-ink-soft)",
          }}
        >
          Lynky is built and maintained by a single developer — no team, no
          company behind it, just something built because it was worth
          building.
        </p>
      </div>

      <div
        className="flex flex-col gap-8 border-t pt-10"
        style={{ borderColor: "var(--color-border)" }}
      >
        {/* Why Lynky */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[140px_1fr] sm:gap-8">
  <span
    className="text-sm"
    style={{
      fontFamily: "var(--font-mono)",
      color: "var(--color-dirty)",
    }}
  >
    01 / why
  </span>

  <div className="flex flex-col gap-2">
    <h2
      className="text-lg"
      style={{
        fontFamily: "var(--font-display)",
        fontWeight: 500,
      }}
    >
      The link should just be a link.
    </h2>

    <p
      className="text-sm leading-relaxed sm:text-base"
      style={{
        fontFamily: "var(--font-body)",
        color: "var(--color-ink-soft)",
      }}
    >
      I built Lynky because links shouldn't have to carry a trail of
      tracking and unnecessary metadata with them.
    </p>
  </div>
</div>

        {/* Who */}
        <div
          className="grid grid-cols-1 gap-2 border-t pt-8 sm:grid-cols-[140px_1fr] sm:gap-8"
          style={{ borderColor: "var(--color-border)" }}
        >
          <span
            className="text-sm"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--color-dirty)",
            }}
          >
            02 / who
          </span>

          <div className="flex flex-col gap-2">
            <h2
              className="text-lg"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 500,
              }}
            >
              Harsh Sanket
            </h2>

            <p
              className="text-sm leading-relaxed sm:text-base"
              style={{
                fontFamily: "var(--font-body)",
                color: "var(--color-ink-soft)",
              }}
            >
              Software engineer, based in — and proudly building out of —
              Mumbai.
            </p>

            <a
              href="https://github.com/harshsanket"
              target="_blank"
              rel="noreferrer"
              className="w-fit text-sm underline-offset-4 hover:underline"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--color-clean)",
              }}
            >
              github.com/harshsanket
            </a>
          </div>
        </div>

        {/* The code */}
        <div
          className="grid grid-cols-1 gap-2 border-t pt-8 sm:grid-cols-[140px_1fr] sm:gap-8"
          style={{ borderColor: "var(--color-border)" }}
        >
          <span
            className="text-sm"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--color-dirty)",
            }}
          >
            03 / code
          </span>

          <div className="flex flex-col gap-2">
            <h2
              className="text-lg"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 500,
              }}
            >
              It's all open
            </h2>

            <p
              className="text-sm leading-relaxed sm:text-base"
              style={{
                fontFamily: "var(--font-body)",
                color: "var(--color-ink-soft)",
              }}
            >
              The project repo, if you'd like to see how it's put together
              or file an issue.
            </p>

            <a
              href="https://github.com/Harshsanket/Lynky"
              target="_blank"
              rel="noreferrer"
              className="w-fit text-sm underline-offset-4 hover:underline"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--color-clean)",
              }}
            >
              github.com/harshsanket/lynky
            </a>
          </div>
        </div>

        {/* Thanks */}
        <div
          className="grid grid-cols-1 gap-2 border-t pt-8 sm:grid-cols-[140px_1fr] sm:gap-8"
          style={{ borderColor: "var(--color-border)" }}
        >
          <span
            className="text-sm"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--color-dirty)",
            }}
          >
            04 / thanks
          </span>

          <div className="flex flex-col gap-4">
            <p
              className="text-sm leading-relaxed sm:text-base"
              style={{
                fontFamily: "var(--font-body)",
                color: "var(--color-ink-soft)",
              }}
            >
              Lynky didn't get built alone. Thanks to:
            </p>

            <ul className="flex flex-col gap-3">
              {THANKS.map((t) => (
                <li
                  key={t.name}
                  className="flex flex-wrap items-baseline gap-x-2"
                >
                  {t.url ? (
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium underline-offset-4 hover:underline"
                      style={{
                        fontFamily: "var(--font-body)",
                        color: "var(--color-ink)",
                      }}
                    >
                      {t.name}
                    </a>
                  ) : (
                    <span
                      className="text-sm font-medium"
                      style={{
                        fontFamily: "var(--font-body)",
                        color: "var(--color-ink)",
                      }}
                    >
                      {t.name}
                    </span>
                  )}

                  <span
                    className="text-sm"
                    style={{
                      fontFamily: "var(--font-body)",
                      color: "var(--color-ink-soft)",
                    }}
                  >
                    — {t.note}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
};

export default About;