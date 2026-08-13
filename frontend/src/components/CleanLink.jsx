import { useState } from "react";
import { ClipboardPen } from "lucide-react"
const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "msclkid",
  "twclid",
  "yclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_src",
  "ref_url",
  "_ga",
  "spm",
];

function cleanLink(raw) {
  try {
    const url = new URL(raw.trim());

    const trackingParams = new Set(
      TRACKING_PARAMS.map((param) => param.toLowerCase())
    );

    [...url.searchParams.keys()].forEach((key) => {
      const normalizedKey = key.toLowerCase();

      if (
        trackingParams.has(normalizedKey) ||
        normalizedKey.startsWith("utm_")
      ) {
        url.searchParams.delete(key);
      }
    });

    return url.toString();
  } catch {
    return null;
  }
}

function UrlCleaner() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();

    if (!input.trim()) return;

    const cleaned = cleanLink(input);

    if (cleaned === null) {
      setError(true);
      setResult(null);
      return;
    }

    setError(false);
    setResult(cleaned);
    setCopied(false);
  }

  async function handleCopy() {
    if (!result) return;

    try {
      await navigator.clipboard.writeText(result);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch {
      setCopied(false);
    }
  }

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
        <ClipboardPen
  className="h-4 w-4"
  style={{
    color: "var(--color-clean)",
    opacity: 0.5,
  }}
/>
        {/* <span
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
        /> */}

        <span
          className="ml-2 text-xs tracking-wide"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-ink-soft)",
          }}
        >
          paste a link to see it cleaned
        </span>
      </div>

      <div className="px-4 py-6 sm:px-6 sm:py-8">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <input
            type="url"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(false);
            }}
            placeholder="https://example.com/product?utm_source=..."
            className="w-full rounded-md border bg-transparent px-3 py-2.5 text-sm outline-none"
            style={{
              borderColor: "var(--color-border)",
              fontFamily: "var(--font-mono)",
              color: "var(--color-ink)",
            }}
          />

          <button
            type="submit"
            className="shrink-0 rounded-md px-4 py-2.5 text-sm"
            style={{
              backgroundColor: "var(--color-ink)",
              color: "var(--color-bg-alt)",
              fontFamily: "var(--font-body)",
              fontWeight: 500,
            }}
          >
            Clean it
          </button>
        </form>

        {error && (
          <p
            className="mt-3 text-xs"
            style={{
              fontFamily: "var(--font-body)",
              color: "var(--color-dirty)",
            }}
          >
            That doesn't look like a valid URL — paste the full link,
            including https://
          </p>
        )}

        {result && !error && (
          <div className="mt-4 flex items-start justify-between gap-3">
            <p
              className="animate-fade-up break-all text-sm leading-relaxed sm:text-base"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--color-clean)",
              }}
            >
              {result}

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

            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 rounded-md border px-3 py-1.5 text-xs"
              style={{
                borderColor: "var(--color-border)",
                color: "var(--color-ink-soft)",
                fontFamily: "var(--font-body)",
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default UrlCleaner;