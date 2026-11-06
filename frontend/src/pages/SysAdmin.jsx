import { useCallback, useEffect, useState } from "react";
import {
  adminLogin,
  adminLogout,
  getAdminBenchmarkReport,
  getAdminErrors,
  getAdminMetrics,
  getAdminSession,
} from "../api/admin.api";

const cardClass =
  "rounded-lg border border-border bg-bg-alt px-4 py-3";

const formatNumber = (value) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString()
    : "—";

const formatBytes = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }

  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
};

const formatMs = (value) =>
  typeof value === "number" && Number.isFinite(value)
    ? `${value.toFixed(2)} ms`
    : "—";

const Sparkline = ({ values, color = "var(--color-clean)" }) => {
  if (!Array.isArray(values) || values.length < 2) {
    return <span className="font-mono text-xs text-ink-soft">not enough samples</span>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 24 - ((value - min) / span) * 20;

      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 28" className="h-8 w-full" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

const LatencyRow = ({ label, entry }) => (
  <tr className="border-t border-border">
    <td className="px-3 py-2">{label}</td>
    <td className="px-3 py-2 font-mono text-xs">{formatMs(entry?.p50)}</td>
    <td className="px-3 py-2 font-mono text-xs">{formatMs(entry?.p90)}</td>
    <td className="px-3 py-2 font-mono text-xs">{formatMs(entry?.p95)}</td>
    <td className="px-3 py-2 font-mono text-xs">{formatMs(entry?.p99)}</td>
    <td className="px-3 py-2 font-mono text-xs">{formatMs(entry?.p999)}</td>
    <td className="px-3 py-2 font-mono text-xs">{formatMs(entry?.max)}</td>
  </tr>
);

const MetricCard = ({ label, value, hint }) => (
  <div className={cardClass}>
    <p className="font-mono text-xs text-ink-soft">{label}</p>
    <p className="mt-1 font-display text-2xl">{value}</p>
    {hint ? (
      <p className="mt-1 text-xs text-ink-soft">{hint}</p>
    ) : null}
  </div>
);

const SysAdmin = () => {
  const [session, setSession] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [metrics, setMetrics] = useState(null);
  const [errors, setErrors] = useState([]);
  const [benchmarkReport, setBenchmarkReport] = useState(null);
  const [benchmarkAvailable, setBenchmarkAvailable] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    const [metricsResponse, errorsResponse, reportResult] =
      await Promise.all([
        getAdminMetrics(),
        getAdminErrors(100),
        getAdminBenchmarkReport()
          .then((response) => ({
            available: true,
            data: response?.data ?? null,
          }))
          .catch(() => ({ available: false, data: null })),
      ]);

    setMetrics(metricsResponse?.data ?? null);
    setErrors(Array.isArray(errorsResponse?.data) ? errorsResponse.data : []);
    setBenchmarkAvailable(reportResult.available);
    setBenchmarkReport(reportResult.data);
  }, []);

  useEffect(() => {
    let cancelled = false;

    getAdminSession()
      .then((response) => {
        if (cancelled) return;

        const data = response?.data;

        if (data?.authenticated) {
          setSession(data);
          loadDashboard().catch((dashboardError) => {
            if (!cancelled) setError(dashboardError.message);
          });
          return;
        }

        setSession(data?.disabled ? { disabled: true } : null);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadDashboard]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    let data;

    try {
      const response = await adminLogin(username, password);
      data = response?.data;
    } catch (loginError) {
      setError(loginError.message);
      setLoading(false);
      return;
    }

    // Switch to the dashboard immediately. The session endpoint returns the
    // same flag on refresh, and adding it here keeps the login response shape
    // from leaving the form stuck on screen.
    setSession({ ...(data ?? {}), authenticated: true });
    setPassword("");
    setLoading(false);

    try {
      await loadDashboard();
    } catch (dashboardError) {
      setError(dashboardError.message);
    }
  };

  const handleLogout = async () => {
    setError("");

    try {
      await adminLogout(session?.csrfToken ?? "");
      setSession(null);
      setMetrics(null);
      setErrors([]);
      setBenchmarkReport(null);
      setBenchmarkAvailable(false);
    } catch (logoutError) {
      setError(logoutError.message);
    }
  };

  if (loading && !session) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center px-6 py-16">
        <p className="font-mono text-sm text-ink-soft">loading sysadmin…</p>
      </main>
    );
  }

  if (session?.disabled) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-6 py-16">
        <h1 className="font-display text-3xl">Sysadmin</h1>
        <p className="text-ink-soft">Admin access is disabled.</p>
      </main>
    );
  }

  if (!session?.authenticated) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
        <div>
          <span className="font-mono text-xs text-ink-soft">
            restricted area
          </span>
          <h1 className="mt-2 font-display text-3xl">Sysadmin</h1>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-xs text-ink-soft">username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              className="rounded-md border border-border bg-bg-alt px-3 py-2 font-mono text-sm outline-none focus:border-ink"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-xs text-ink-soft">password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className="rounded-md border border-border bg-bg-alt px-3 py-2 font-mono text-sm outline-none focus:border-ink"
            />
          </label>

          {error ? (
            <p role="alert" className="text-sm text-dirty">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-bg-alt transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "signing in…" : "sign in"}
          </button>
        </form>

        <p className="text-center font-mono text-[10px] leading-relaxed text-ink-soft">
          Sessions last 30 minutes after the last request, with an 8-hour
          maximum.
        </p>
      </main>
    );
  }

  const stats = metrics?.stats ?? {};
  const cache = metrics?.cache ?? {};
  const shortCodeExhausted = metrics?.shortCodeExhausted ?? 0;
  const latency = metrics?.latency ?? {
    create: {},
    redirect: {},
  };
  const report = benchmarkReport;
  const reportLatency = report?.latency ?? {};
  const reportCollisions = report?.collisions ?? {};
  const reportFailures = report?.failures ?? {};
  const reportStorage = report?.storage ?? {};
  const reportTelemetry = report?.telemetry ?? {};
  const reportSecurity = report?.security ?? {};
  const reportFailSafes = Array.isArray(report?.failSafes)
    ? report.failSafes
    : [];
  const metricsTelemetry = Array.isArray(metrics?.telemetry)
    ? metrics.telemetry
    : [];
  const metricLagValues = metricsTelemetry.map(
    (sample) => sample.eventLoopLagP99Ms ?? 0
  );
  const metricRssValues = metricsTelemetry.map((sample) => sample.rssMb ?? 0);
  const reportTimeline = Array.isArray(reportTelemetry.timeline)
    ? reportTelemetry.timeline
    : [];
  const lagTimeline = reportTimeline
    .map((sample) => sample.health?.body?.telemetry?.eventLoopLagP99Ms)
    .filter((value) => typeof value === "number");
  const rssTimeline = reportTimeline
    .map((sample) => sample.health?.body?.telemetry?.rssMb)
    .filter((value) => typeof value === "number");
  const latencyRows = [
    ["create E2E", reportLatency.create],
    ["redirect hot", reportLatency.redirectHot],
    ["redirect cold", reportLatency.redirectCold],
    ["algorithms", reportLatency.algorithms],
    ["dedupe lookup", reportLatency.dedupe],
    ["short-code generation", reportLatency.codegen],
    ["insert", reportLatency.insert],
    ["event-loop lag", reportLatency.eventLoopLag],
  ];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="font-mono text-xs text-ink-soft">
            logged in {new Date(session.loggedInAt).toLocaleString()}
          </span>
          <h1 className="font-display text-3xl">Sysadmin dashboard</h1>
          <p className="text-sm text-ink-soft">
            last seen {new Date(session.lastSeenAt).toLocaleString()}
          </p>
          <p className="text-xs text-ink-soft">
            30-minute idle timeout · 8-hour session cap
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="rounded-md border border-border px-4 py-2 text-sm transition-colors hover:bg-bg-alt"
        >
          log out
        </button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-dirty">
          {error}
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="total links created"
          value={formatNumber(stats.totalLinks)}
        />
        <MetricCard
          label="successful clicks"
          value={formatNumber(stats.totalClicksSuccess)}
        />
        <MetricCard
          label="short-link requests"
          value={formatNumber(stats.totalClicksAttempts)}
        />
        <MetricCard
          label="failed clicks"
          value={formatNumber(stats.totalClicksFailed)}
        />
        <MetricCard
          label="short-code exhaustion (24h)"
          value={formatNumber(shortCodeExhausted)}
          hint="real 503s after all attempts"
        />
        <MetricCard
          label="link generation latency"
          value={`${formatNumber(latency.create?.avgMs)} ms`}
          hint={`min ${formatNumber(latency.create?.minMs)} / max ${formatNumber(latency.create?.maxMs)} ms`}
        />
        <MetricCard
          label="redirect latency"
          value={`${formatNumber(latency.redirect?.avgMs)} ms`}
          hint={`min ${formatNumber(latency.redirect?.minMs)} / max ${formatNumber(latency.redirect?.maxMs)} ms`}
        />
        <MetricCard
          label="cache hit / miss"
          value={`${formatNumber(cache.cacheHit)} / ${formatNumber(cache.cacheMiss)}`}
          hint="last 24h hourly rollups"
        />
      </section>

      {benchmarkAvailable ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl">Benchmark report</h2>
          {report?.startedAt ? (
            <span className="font-mono text-xs text-ink-soft">
              {new Date(report.startedAt).toLocaleString()}
            </span>
          ) : null}
        </div>

        {!report ? (
          <p className="text-sm text-ink-soft">
            No benchmark run recorded yet. Run the §21 load harness to populate
            this section.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="run"
                value={report.status ?? "—"}
                hint={`${report.runId ?? "—"} · ${formatNumber(report.durationSeconds)} s`}
              />
              <MetricCard
                label="create success"
                value={formatNumber(reportFailures.success)}
                hint={`${formatNumber(reportFailures.attempted)} attempted · ${reportFailures.successRate ?? "—"}%`}
              />
              <MetricCard
                label="link rows"
                value={formatNumber(reportStorage.rows)}
                hint={`expected ${formatNumber(reportStorage.expectedDistinct)}`}
              />
              <MetricCard
                label="event-loop lag p99"
                value={formatMs(reportLatency.eventLoopLag?.p99)}
                hint={`peak RSS ${formatNumber(reportTelemetry.peakRssMb)} MB`}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className={cardClass}>
                <p className="font-mono text-xs text-ink-soft">
                  event-loop lag p99
                </p>
                <Sparkline values={lagTimeline} color="var(--color-dirty)" />
              </div>
              <div className={cardClass}>
                <p className="font-mono text-xs text-ink-soft">RSS</p>
                <Sparkline values={rssTimeline} color="var(--color-clean)" />
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-175 text-left text-sm">
                <thead className="bg-bg-alt font-mono text-xs text-ink-soft">
                  <tr>
                    <th className="px-3 py-2">latency</th>
                    <th className="px-3 py-2">p50</th>
                    <th className="px-3 py-2">p90</th>
                    <th className="px-3 py-2">p95</th>
                    <th className="px-3 py-2">p99</th>
                    <th className="px-3 py-2">p999</th>
                    <th className="px-3 py-2">max</th>
                  </tr>
                </thead>
                <tbody>
                  {latencyRows.map(([label, entry]) => (
                    <LatencyRow key={label} label={label} entry={entry} />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className={cardClass}>
                <p className="font-mono text-xs text-ink-soft">
                  code generation
                </p>
                <p className="mt-1 text-sm">
                  {formatNumber(reportCollisions.codesGenerated)} codes ·{" "}
                  {formatNumber(reportCollisions.retriedRequests)} retried
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  mean {reportCollisions.meanRetries ?? "—"} · max{" "}
                  {reportCollisions.maxRetries ?? "—"} · 503{" "}
                  {formatNumber(reportCollisions.exhausted503)}
                </p>
              </div>

              <div className={cardClass}>
                <p className="font-mono text-xs text-ink-soft">storage</p>
                <p className="mt-1 text-sm">
                  {formatBytes(reportStorage.dataSizeBytes)} data ·{" "}
                  {formatBytes(reportStorage.indexSizeBytes)} index
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  {formatNumber(reportStorage.urlHashEntries)} urlHash ·{" "}
                  {formatNumber(reportStorage.codeHashEntries)} codeHash
                </p>
              </div>

              <div className={cardClass}>
                <p className="font-mono text-xs text-ink-soft">
                  failure classes
                </p>
                <p className="mt-1 text-sm">
                  {formatNumber(reportFailures.classes?.["413"])} · 413 /{" "}
                  {formatNumber(reportFailures.classes?.["400"])} · 400 /{" "}
                  {formatNumber(reportFailures.classes?.["5xx"])} · 5xx
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  {formatNumber(reportFailures.classes?.["429"])} · 429
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-175 text-left text-sm">
                <thead className="bg-bg-alt font-mono text-xs text-ink-soft">
                  <tr>
                    <th className="px-3 py-2">fail-safe</th>
                    <th className="px-3 py-2">result</th>
                    <th className="px-3 py-2">evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {reportFailSafes.map((entry) => (
                    <tr key={entry.name} className="border-t border-border">
                      <td className="px-3 py-2 font-mono text-xs">
                        {entry.name}
                      </td>
                      <td className="px-3 py-2">
                        {entry.result === "pass" ? "pass" : entry.result}
                      </td>
                      <td className="px-3 py-2 text-xs text-ink-soft">
                        {entry.evidence ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-border p-4">
              <p className="font-mono text-xs text-ink-soft">security</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>
                  plaintext URLs in logs:{" "}
                  {reportSecurity.plaintextUrlsInLogs ? "found" : "none found"}
                </li>
                <li>
                  production masking:{" "}
                  {reportSecurity.productionMasking ?? "—"}
                </li>
                <li>
                  Redis ciphertext only:{" "}
                  {reportSecurity.redisCiphertextOnly ? "yes" : "not verified"}
                </li>
                <li>
                  sampled 201 decrypt roundtrip:{" "}
                  {reportSecurity.decryptRoundtrip ? "pass" : "not verified"}
                </li>
                <li>
                  unique index counts match rows:{" "}
                  {reportSecurity.uniqueIndexCountsMatch ? "yes" : "not verified"}
                </li>
                <li>
                  admin no-store / cookie flags:{" "}
                  {reportSecurity.adminHeaders ?? "—"}
                </li>
              </ul>
            </div>

            {Array.isArray(report.notes) && report.notes.length > 0 ? (
              <div className="rounded-lg border border-border p-4">
                <p className="font-mono text-xs text-ink-soft">
                  notes / follow-up
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {report.notes.map((note, index) => (
                    <li key={`${index}-${note.slice(0, 24)}`}>{note}</li>
                  ))}
                </ul>
                {report.followUp?.negativeCacheFix ? (
                  <p className="mt-2 text-sm">
                    negative-cache fix:{" "}
                    {report.followUp.negativeCacheFix.result} ·{" "}
                    {report.followUp.negativeCacheFix.fix}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl">Runtime telemetry (24h)</h2>

        {metricsTelemetry.length === 0 ? (
          <p className="text-sm text-ink-soft">
            No telemetry samples recorded. Run with `SERVER_STAGE_TIMINGS=1`.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className={cardClass}>
              <p className="font-mono text-xs text-ink-soft">
                event-loop lag p99
              </p>
              <Sparkline
                values={metricLagValues}
                color="var(--color-dirty)"
              />
            </div>
            <div className={cardClass}>
              <p className="font-mono text-xs text-ink-soft">RSS</p>
              <Sparkline values={metricRssValues} color="var(--color-clean)" />
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl">Recent errors (90d)</h2>

        {errors.length === 0 ? (
          <p className="text-sm text-ink-soft">No errors recorded.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-bg-alt font-mono text-xs text-ink-soft">
                <tr>
                  <th className="px-3 py-2">time</th>
                  <th className="px-3 py-2">route</th>
                  <th className="px-3 py-2">status</th>
                  <th className="px-3 py-2">code</th>
                  <th className="px-3 py-2">request</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((entry) => (
                  <tr
                    key={`${entry._id ?? entry.at}-${entry.requestId ?? ""}`}
                    className="border-t border-border"
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                      {new Date(entry.at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {entry.route}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {entry.status}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {entry.errorCode ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {entry.requestId ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
};

export default SysAdmin;
