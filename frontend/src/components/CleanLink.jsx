import { useRef, useState } from 'react';
import {
  Clipboard,
  ArrowRight,
  X,
  LoaderCircle,
  Copy,
  Check,
} from 'lucide-react';

import { createShortUrl } from '../api/url.api';

const COOLDOWN_MS = 2000;

const INVALID_URL_MESSAGE =
  "That doesn't look like a valid URL — paste the full link, including https://";

/**
 * Whether the input is a non-empty HTTP(S) URL with a host. Everything else
 * (plain text, javascript:, data:, etc.) is rejected before it reaches the API.
 */
const isValidUrl = (value) => {
  if (!value || typeof value !== 'string') return false;

  const trimmed = value.trim();

  if (!trimmed || trimmed.includes('\\')) return false;

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * UrlCleaner — the home page's interactive cleaner.
 *
 * Type or paste a URL; on submit it calls the shorten API, shows the cleaned
 * short link, and offers copy/clear actions. A cooldown prevents rapid
 * repeat submissions (mirrors the backend's per-IP link rate limit).
 */
function UrlCleaner() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);

  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  const cooldownTimer = useRef(null);

  function triggerCooldown() {
    setCooldown(true);

    clearTimeout(cooldownTimer.current);

    cooldownTimer.current = setTimeout(() => {
      setCooldown(false);
    }, COOLDOWN_MS);
  }

  async function runShortener(value) {
    const url = value.trim();

    if (!url || loading || cooldown || result) return;

    if (!isValidUrl(url)) {
      setError(true);
      setErrorMessage(INVALID_URL_MESSAGE);
      return;
    }

    setLoading(true);
    setError(false);
    setErrorMessage('');
    setCopied(false);

    try {
      const response = await createShortUrl(url);

      setResult(response.data.shortUrl);
    } catch (error) {
      console.error('Failed to shorten URL:', error);

      setError(true);
      setErrorMessage(
        error?.data?.message || error?.message || 'Unable to shorten this URL.',
      );
    } finally {
      setLoading(false);
      triggerCooldown();
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    runShortener(input);
  }

  async function handlePasteButtonClick() {
    if (loading || cooldown || result) return;

    try {
      const text = await navigator.clipboard.readText();

      const value = text.trim();

      if (!value) return;

      setInput(value);

      await runShortener(value);
    } catch {
      setError(true);
      setErrorMessage('Unable to read from clipboard.');
    }
  }

  function handleInputPaste(e) {
    const pasted = e.clipboardData.getData('text').trim();

    if (!pasted) return;

    e.preventDefault();

    setInput(pasted);

    setTimeout(() => {
      runShortener(pasted);
    }, 0);
  }

  function handleClear() {
    setInput('');
    setResult(null);
    setError(false);
    setErrorMessage('');
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

  const disabled = loading || cooldown;
  const clearDisabled = loading;

  return (
    <div
      className="w-full rounded-lg border"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-bg-alt)',
      }}
    >
      <div
        className="flex items-center gap-2 border-b px-4 py-2.5"
        style={{
          borderColor: 'var(--color-border)',
        }}
      >
        <Clipboard
          className="h-4 w-4"
          style={{
            color: 'var(--color-clean)',
            opacity: 0.5,
          }}
        />

        <span
          className="ml-2 text-xs tracking-wide"
          style={{
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-ink-soft)',
          }}
        >
          paste a link to see it cleaned
        </span>
      </div>

      <div className="px-4 py-6 sm:px-6 sm:py-8">
        <form onSubmit={handleSubmit} noValidate>
          <div
            className="flex min-h-11 w-full items-center gap-2 rounded-md border px-3"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'transparent',
            }}
          >
            <div className="min-w-0 flex-1 overflow-hidden">
              {!result ? (
                <input
                  type="url"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    setError(false);
                    setErrorMessage('');
                  }}
                  onPaste={handleInputPaste}
                  placeholder="https://example.com/product?utm_source=..."
                  disabled={loading}
                  className="w-full bg-transparent py-2.5 text-sm outline-none"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-ink)',
                  }}
                />
              ) : (
                <div
                  className="relative overflow-hidden whitespace-nowrap py-2.5 text-sm"
                  style={{
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  <span
                    className="url-result-reveal relative inline-block"
                    style={{
                      color: 'var(--color-clean)',
                    }}
                  >
                    {result}
                  </span>
                </div>
              )}
            </div>

            {result ? (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label="Copy shortened URL"
                  className="flex h-8 w-8 items-center justify-center rounded-md"
                  style={{
                    color: copied
                      ? 'var(--color-clean)'
                      : 'var(--color-ink-soft)',
                    backgroundColor: 'var(--color-bg)',
                  }}
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4 hover:text-black" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleClear}
                  disabled={clearDisabled}
                  aria-label="Clear URL"
                  className="flex h-8 w-8 items-center justify-center rounded-md disabled:cursor-not-allowed"
                  style={{
                    color: 'var(--color-ink-soft)',
                    backgroundColor: 'var(--color-bg)',
                    opacity: clearDisabled ? 0.4 : 1,
                  }}
                >
                  <X className="h-4 w-4 hover:text-black" />
                </button>
              </div>
            ) : (
              <button
                type={input.trim() ? 'submit' : 'button'}
                onClick={input.trim() ? undefined : handlePasteButtonClick}
                disabled={disabled}
                aria-label={
                  loading
                    ? 'Cleaning link'
                    : input.trim()
                      ? 'Submit link'
                      : 'Paste link'
                }
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md disabled:cursor-not-allowed"
                style={{
                  backgroundColor: 'var(--color-ink)',
                  color: 'var(--color-bg-alt)',
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                {loading ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : input.trim() ? (
                  <ArrowRight className="h-4 w-4" />
                ) : (
                  <Clipboard className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </form>

        {error && (
          <p
            className="mt-3 text-xs"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-dirty)',
            }}
          >
            {errorMessage ||
              INVALID_URL_MESSAGE}
          </p>
        )}
      </div>
    </div>
  );
}

export default UrlCleaner;
