import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { getApiKeyUsage } from '../api/usage.api';
import LeafCorner from '../components/LeafCorner';
import {
  API_KEY_LENGTH,
  isValidApiKey,
  sanitizeApiKey,
} from '../lib/api-key';

const POLL_INTERVAL_MS = 10000;

const INVALID_KEY_MESSAGE =
  'Invalid API key. Paste the key exactly as it was issued.';

/**
 * Render a usage number, falling back to a dash when the API returned an
 * unexpected payload (for example a legacy record without counters).
 */
const formatCount = (value) =>
  typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString()
    : '—';

/**
 * The raw API secret is intentionally kept only in React state: it is never
 * written to localStorage/sessionStorage, so a refresh or tab restore forces
 * the user to re-enter it. Usage numbers follow the same rule.
 */
const API_Usage = () => {
  const navigate = useNavigate();
  const [secretKey, setSecretKey] = useState('');
  const [usage, setUsage] = useState(null);
  const [usageError, setUsageError] = useState('');
  const [loadingUsage, setLoadingUsage] = useState(false);
  const pollRef = useRef(null);

  // Once usage is showing, keep it fresh in the background every 10s.
  // A simple in-flight guard prevents overlapping requests on slow networks.
  useEffect(() => {
    if (!usage || !secretKey) return;

    let cancelled = false;
    let inFlight = false;

    pollRef.current = setInterval(async () => {
      // Do not spend requests while the tab is in the background.
      if (cancelled || inFlight || document.hidden) return;

      inFlight = true;

      try {
        const data = await getApiKeyUsage(secretKey);

        if (!cancelled) setUsage(data?.data);
      } catch (error) {
        // Keep the last known numbers on transient failures, but drop the
        // session when the key is no longer accepted.
        if (
          !cancelled &&
          (error?.status === 401 || error?.status === 403)
        ) {
          setSecretKey('');
          setUsage(null);
          setUsageError(
            error?.data?.message || 'This API key is no longer valid.',
          );
        }
      } finally {
        inFlight = false;
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(usage), secretKey]);

  const handleViewUsage = async () => {
    const key = secretKey.trim();

    if (!key || loadingUsage) return;

    if (!isValidApiKey(key)) {
      setUsageError(INVALID_KEY_MESSAGE);
      return;
    }

    setLoadingUsage(true);
    setUsage(null);
    setUsageError('');

    try {
      const data = await getApiKeyUsage(key);

      setUsage(data?.data);
    } catch (error) {
      setUsageError(
        error?.data?.message || 'Unable to load usage stats.',
      );
    } finally {
      setLoadingUsage(false);
    }
  };

  const handleExit = () => {
    clearInterval(pollRef.current);
    setSecretKey('');
    setUsage(null);
    setUsageError('');
    navigate('/');
  };

  return (
    <div className="relative w-full overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* leafy corner decoration — purely decorative, sits behind content */}
      <LeafCorner className="pointer-events-none absolute -left-4 -top-4 sm:-left-2 sm:-top-2" />
      <LeafCorner className="pointer-events-none absolute -right-4 -bottom-4 rotate-180 sm:-right-2 sm:-bottom-2" />

      <div className="relative mx-auto flex w-full max-w-3xl flex-col px-6 py-14 sm:px-8">
        <div className="flex flex-col gap-4">
          <span
            className="text-xs uppercase tracking-widest"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink-soft)' }}
          >
            {usage ? "Members only" : 'API'}
          </span>

          <h1
            className="text-3xl leading-[1.1] sm:text-4xl"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}
          >
            {usage ? "Welcome to Lynky's secret club." : 'Check your API usage'}
          </h1>

          <p
            className="max-w-xl text-base leading-relaxed sm:text-lg"
            style={{ fontFamily: 'var(--font-body)', color: 'var(--color-ink-soft)' }}
          >
            {usage
              ? 'Here\u2019s where your quota stands, refreshing on its own every few seconds. Keep your secret key to yourself \u2014 anyone who has it can spend it.'
              : 'Paste your secret key below and we\u2019ll show you exactly how much of your monthly quota is left. It stays in this tab\u2019s memory only, so a refresh clears it.'}
          </p>
        </div>

        <div
          className="mt-6 w-full overflow-hidden rounded-lg border"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-bg-alt)',
          }}
        >
          <div
            className="flex items-center justify-between gap-2 border-b px-4 py-2.5"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <span
              className="text-xs tracking-wide"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink-soft)' }}
            >
              {usage ? ' Your API Usage' : 'enter your API key'}
            </span>

            {usage && (
              <span
                className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-clean)' }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: 'var(--color-clean)' }}
                />
                updates every 10s
              </span>
            )}
          </div>

          <div className="px-4 py-5 sm:px-6">
            {!usage && (
              <div
                className="flex min-h-11 w-full items-center gap-2 rounded-md border px-3"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'transparent' }}
              >
                <input
                  type="password"
                  value={secretKey}
                  onChange={(e) => {
                    setSecretKey(sanitizeApiKey(e.target.value));
                    setUsage(null);
                    setUsageError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleViewUsage();
                  }}
                  placeholder="Paste your API key"
                  aria-label="API key"
                  aria-invalid={Boolean(usageError)}
                  aria-describedby={usageError ? 'usage-error' : undefined}
                  disabled={loadingUsage}
                  autoComplete="off"
                  maxLength={API_KEY_LENGTH}
                  className="w-full flex-1 bg-transparent py-2.5 text-sm outline-none"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink)' }}
                />

                <button
                  type="button"
                  onClick={handleViewUsage}
                  disabled={loadingUsage || !secretKey.trim()}
                  className="flex h-8 shrink-0 items-center rounded-md px-4 text-xs font-medium disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: 'var(--color-ink)',
                    color: 'var(--color-bg-alt)',
                    opacity: loadingUsage || !secretKey.trim() ? 0.5 : 1,
                  }}
                >
                  {loadingUsage ? 'Loading…' : 'View usage'}
                </button>
              </div>
            )}

            {usageError && (
              <p
                id="usage-error"
                role="alert"
                className="mt-3 text-xs"
                style={{ fontFamily: 'var(--font-body)', color: 'var(--color-dirty)' }}
              >
                {usageError}
              </p>
            )}

            {usage && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div
                  className="rounded-md border px-4 py-3"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
                >
                  <p
                    className="text-[10px] uppercase tracking-widest"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink-soft)' }}
                  >
                    Current usage
                  </p>
                  <p
                    className="mt-1 text-lg"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink)' }}
                  >
                    {formatCount(usage.currentUsage)}
                  </p>
                </div>

                <div
                  className="rounded-md border px-4 py-3"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
                >
                  <p
                    className="text-[10px] uppercase tracking-widest"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink-soft)' }}
                  >
                    Monthly limit
                  </p>
                  <p
                    className="mt-1 text-lg"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink)' }}
                  >
                    {formatCount(usage.monthlyLimit)}
                  </p>
                </div>

                <div
                  className="rounded-md border px-4 py-3"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
                >
                  <p
                    className="text-[10px] uppercase tracking-widest"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink-soft)' }}
                  >
                    Total (12 months)
                  </p>
                  <p
                    className="mt-1 text-lg"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink)' }}
                  >
                    {formatCount(usage.totalUsage12m)}
                  </p>
                </div>

                <p
                  className="text-xs sm:col-span-3"
                  style={{ fontFamily: 'var(--font-body)', color: 'var(--color-ink-soft)' }}
                >
                  {usage.month ?? 'Current month'} · resets at the end of every month
                </p>
              </div>
            )}
          </div>
        </div>

        {usage && (
          <button
            type="button"
            onClick={handleExit}
            className="mt-6 w-fit rounded-md border px-5 py-3 text-sm font-medium transition-colors"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-ink)',
            }}
          >
            Exit club
          </button>
        )}
      </div>
    </div>
  );
};

export default API_Usage;