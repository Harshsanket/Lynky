import { useState, useEffect, useRef } from "react";

// The messy, trackable URL we clean on loop in the hero.
const BASE_URL = "https://example.com/product";

const PARAMS = [
  "?utm_source=newsletter",
  "&utm_medium=email",
  "&fbclid=IwAR2x9pQ",
  "&ref=sharebtn",
];

const CLEAN_URL = "https://lynky.to/x7hQ2";

function UrlCleaner() {
  const [struck, setStruck] = useState(0);
  const [showClean, setShowClean] = useState(false);
  const timeouts = useRef([]);

  useEffect(() => {
    function run() {
      timeouts.current.forEach(clearTimeout);
      timeouts.current = [];

      setStruck(0);
      setShowClean(false);

      PARAMS.forEach((_, i) => {
        const t = setTimeout(() => {
          setStruck(i + 1);
        }, 500 + i * 550);

        timeouts.current.push(t);
      });

      const cleanDelay = 500 + PARAMS.length * 550 + 400;

      timeouts.current.push(
        setTimeout(() => setShowClean(true), cleanDelay)
      );

      timeouts.current.push(
        setTimeout(() => run(), cleanDelay + 2600)
      );
    }

    run();

    return () => {
      timeouts.current.forEach(clearTimeout);
    };
  }, []);

  return (
    <div
      className="w-full rounded-lg border"
      style={{
        borderColor: "var(--color-border)",
        backgroundColor: "var(--color-bg-alt)",
      }}
    >
      <div
        className="flex items-center gap-2 border-b px-4 py-2.5"
        style={{ borderColor: "var(--color-border)" }}
      >
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
          className="ml-2 text-xs tracking-wide"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-ink-soft)",
          }}
        >
          the link you were about to share
        </span>
      </div>

      <div className="px-4 py-6 sm:px-6 sm:py-8">
        {!showClean ? (
          <p
            className="break-all text-sm leading-relaxed sm:text-base"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <span>{BASE_URL}</span>

            {PARAMS.map((param, i) =>
              i < struck ? (
                <span key={param} className="strike-param">
                  {param}
                </span>
              ) : (
                <span key={param}>{param}</span>
              )
            )}
          </p>
        ) : (
          <p
            className="animate-fade-up break-all text-sm leading-relaxed sm:text-base"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--color-clean)",
            }}
          >
            {CLEAN_URL}

            <span
              className="ml-3 rounded-full px-2 py-0.5 text-xs align-middle"
              style={{
                backgroundColor: "var(--color-clean-soft)",
                color: "var(--color-clean)",
                fontFamily: "var(--font-body)",
              }}
            >
              cleaned
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

function Feature({ mark, title, body }) {
  return (
    <div className="flex flex-col gap-2">
      <span
        className="text-sm"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--color-dirty)",
        }}
      >
        {mark}
      </span>

      <h3
        className="text-lg"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h3>

      <p
        className="text-sm leading-relaxed"
        style={{ color: "var(--color-ink-soft)" }}
      >
        {body}
      </p>
    </div>
  );
}

export default function App() {
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();

    if (!email.trim()) return;

    setJoined(true);
  }

  return (
    <div
      className="min-h-screen w-full"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      {/* Faint paper texture */}
      <div className="pointer-events-none fixed inset-0 paper-grain" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 sm:px-8">
        {/* Nav */}
        <header className="flex items-center justify-between py-8">
          <span
            className="text-xl"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
            }}
          >
            lynky
          </span>

          <span
            className="text-xs tracking-widest"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--color-ink-soft)",
              textTransform: "uppercase",
            }}
          >
            coming soon
          </span>
        </header>

        {/* Hero */}
        <main className="flex flex-1 flex-col justify-center gap-10 py-12">
          <div className="flex flex-col gap-5">
            <span
              className="w-fit rounded-full border px-3 py-1 text-xs"
              style={{
                borderColor: "var(--color-border)",
                color: "var(--color-ink-soft)",
                fontFamily: "var(--font-mono)",
              }}
            >
              a shorter, quieter link
            </span>

            <h1
              className="text-4xl leading-[1.1] sm:text-5xl"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 500,
              }}
            >
              Every link tells on you.
            </h1>

            <p
              className="max-w-xl text-base leading-relaxed sm:text-lg"
              style={{ color: "var(--color-ink-soft)" }}
            >
              Trackers, session IDs, and referral tags ride along in every URL
              you share, and they usually make the link too long to look at
              twice. Lynky strips that out and shortens what's left, so the
              link you send is just the link.
            </p>
          </div>

          <UrlCleaner />

        

          {/* Features */}
          <div
            className="grid grid-cols-1 gap-8 border-t pt-10 sm:grid-cols-3"
            style={{ borderColor: "var(--color-border)" }}
          >
            <Feature
              mark="01 / strip"
              title="Trackers, gone"
              body="utm_source, fbclid, gclid, and the rest get removed before your link goes anywhere."
            />

            <Feature
              mark="02 / shorten"
              title="Actually short"
              body="What's left gets shortened into a link that's pleasant to paste into a message."
            />

            <Feature
              mark="03 / forget"
              title="No cookies, no logs"
              body="Lynky doesn't watch what you click. It cleans the link and gets out of the way."
            />
          </div>
        </main>

        <footer
          className="flex items-center justify-between border-t py-6 text-xs"
          style={{
            borderColor: "var(--color-border)",
            color: "var(--color-ink-soft)",
          }}
        >
          <span style={{ fontFamily: "var(--font-mono)" }}>
            lynky — a <b>Harsh Sanket</b> productions
          </span>

          <span>© {new Date().getFullYear()}</span>
        </footer>
      </div>
    </div>
  );
}