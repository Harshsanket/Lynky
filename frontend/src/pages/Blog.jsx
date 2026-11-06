/**
 * Blog — a source-available engineering walkthrough of the Lynky request path.
 *
 * The article uses `ArticleSection` (Blog-only layout) so figures lead each
 * section before the supporting prose. Existing figures and visual tokens are
 * retained; the content follows the implementation, tests, and bench report.
 */

import { mono, body, display } from "../lib/theme";
import ArticleSection from "../components/blog/ArticleSection";
import TrailPoint from "../components/blog/TrailPoint";
import RedirectChainDiagram from "../components/blog/RedirectChainDiagram";
import TwoJobsFigure from "../components/blog/TwoJobsFigure";
import UrlTeardownFigure from "../components/blog/UrlTeardownFigure";
import ParamLedger from "../components/blog/ParamLedger";
import CleanResult from "../components/blog/CleanResult";
import PipelineFigure from "../components/blog/PipelineFigure";
import BlocklistDecisionFigure from "../components/blog/BlocklistDecisionFigure";
import CreateFlowFigure from "../components/blog/CreateFlowFigure";
import RedirectCacheFigure from "../components/blog/RedirectCacheFigure";
import CapacityFigure from "../components/blog/CapacityFigure";
import ArchitectureFigure from "../components/blog/ArchitectureFigure";
import ShortcutSetup from "../components/blog/ShortcutSetup";
import BoundaryFigure from "../components/blog/BoundaryFigure";
import { MOTION_STYLES } from "../components/blog/constants";

const FIELD_CARD =
  "bg-(--color-bg-alt) p-5 sm:p-6";

const Field = ({ label, value, note }) => (
  <div className={FIELD_CARD}>
    <span
      className="text-[9px] uppercase tracking-[0.16em]"
      style={{ ...mono, color: "var(--color-dirty)" }}
    >
      {label}
    </span>
    <p
      className="mt-3 break-all text-sm"
      style={{ ...mono, color: "var(--color-ink)" }}
    >
      {value}
    </p>
    <p
      className="mt-2 text-xs leading-relaxed"
      style={{ ...body, color: "var(--color-ink-soft)" }}
    >
      {note}
    </p>
  </div>
);

const Blog = () => {
  return (
    <main className="mx-auto w-full max-w-210 px-6 pt-0 pb-12 sm:px-8 sm:pt-0 sm:pb-16">
      <style>{MOTION_STYLES}</style>

      {/* HEADER */}
      <header className="pt-6 pb-16 sm:pt-8 sm:pb-20">
        <div className="flex items-center gap-3">
          <span
            className="text-[10px] uppercase tracking-[0.2em]"
            style={{ ...mono, color: "var(--color-dirty)" }}
          >
            how lynky works
          </span>

          <span
            className="h-px w-8"
            style={{ backgroundColor: "var(--color-border)" }}
          />

          <span
            className="text-[10px]"
            style={{ ...mono, color: "var(--color-ink-soft)" }}
          >
            engineering notes / 001
          </span>
        </div>

        <h1
          className="mt-6 max-w-175 text-[2.6rem] leading-[1.03] sm:text-[3.4rem]"
          style={{ ...display, color: "var(--color-ink)", fontWeight: 500 }}
        >
          What happens to a link before Lynky gives it back.
        </h1>

        <p
          className="mt-6 max-w-xl text-base leading-relaxed sm:text-lg"
          style={{ ...body, color: "var(--color-ink-soft)" }}
        >
          A paste passes through validation, rule-based cleaning, short-code
          derivation, encrypted storage, and a cached redirect path. This is the
          implementation story behind those steps, including the limits that
          remain.
        </p>
      </header>

      {/* 01 / ORIENTATION */}
      <ArticleSection
        id="orientation"
        mark="01 / orientation"
        eyebrow="what happens when you paste a link"
        title="A paste is validated, cleaned, shortened, and stored in that order."
        figure={<PipelineFigure />}
      >
        <p>
          A pasted link becomes a short redirect only after a sequence of checks.
          The destination must first be plausible, the URL is cleaned, a code and
          dedupe key are derived, the destination is encrypted and stored, and
          the redirect route serves it through cache and metrics.
        </p>

        <p>
          The browser does cheap pre-flight checks so obvious mistakes fail
          immediately. Those checks are disposable UX: the backend never trusts
          an “already validated” signal and re-derives every decision from the
          raw input. The frontend and backend share the URL parser, not a
          security verdict.
        </p>

        <p>
          The trust boundary is deliberately simple. If the request reaches the
          backend, the backend decides. If it does not, the CDN or firewall has
          already made a different decision outside the application.
        </p>
      </ArticleSection>

      {/* 02 / ACCEPTANCE */}
      <ArticleSection
        id="acceptance"
        mark="02 / acceptance"
        eyebrow="before cleaning"
        title="The destination has to be a public, plausible HTTP(S) address."
        figure={<BlocklistDecisionFigure />}
      >
        <p>
          Validation runs before any cleaning or database work. The input length
          is capped at 640 characters because the request path has a practical
          budget: the UI, JSON body, validator, and stored URL all need a bounded
          size. The cap keeps extremely long tracker-laden links out of scope
          instead of processing an unbounded string. The protocol must be HTTP or
          HTTPS, and the raw input is checked for control characters, bidi
          overrides, backslashes, and credential syntax before parsing.
        </p>

        <p>
          After parsing, the canonical hostname must have a valid RFC 1123
          shape. Embedded credentials are rejected. Loopback, private, carrier-
          grade NAT, link-local, multicast, documentation, benchmarking, and
          obfuscated IP literals are rejected. So are localhost, internal and
          special-use suffixes, and internationalized `xn--` hostnames.
        </p>

        <p>
          Create-time blocklists add destination reputation. Six curated sources
          compile into a binary artifact covering{" "}
          <b style={{ color: "var(--color-ink)" }}>over 1.1M unique hosts</b>,
          plus a smaller exact-URL set. Lookups use a perfect-hash index with
          64-bit verification, a collision table, exact host checks,
          parent-suffix checks, and full-URL checks. The artifact exists because
          loading over a million strings into a runtime `Set` costs hundreds of
          megabytes; the compiled index is roughly 12 MB and loads in
          milliseconds. The compiler can also emit a sorted-hash fallback behind
          a flag. No probabilistic structure is used for blocking: a false
          positive is a policy failure, not a cache miss.
        </p>

        <p>
          Own-link detection rejects Lynky&apos;s own domains before creation, so a
          short link cannot point back into the shortener. IDN handling is
          deliberately conservative. A hostname with an `xn--`
          label is rejected rather than judged by a homoglyph heuristic, and a
          label that merely looks like a brand is not treated as that brand. The
          domain structure is what counts: `google.evil.com` belongs to
          `evil.com`, not `google.com`. Host-suffix and registrable-domain checks
          operate on labels, never on substring matches.
        </p>

        <div
          className="grid gap-px border sm:grid-cols-2"
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "var(--color-border)",
          }}
        >
          <TrailPoint number="01" title="Structure">
            Length, protocol, hostname shape, control characters, bidi overrides,
            backslashes, and raw credential syntax.
          </TrailPoint>
          <TrailPoint number="02" title="Network policy">
            Credentials, loopback, private, CGNAT, link-local, multicast,
            documentation, benchmarking, and obfuscated IP literals.
          </TrailPoint>
          <TrailPoint number="03" title="Identity policy">
            Localhost, internal suffixes, special-use domains, and `xn--` IDN
            hostnames.
          </TrailPoint>
          <TrailPoint number="04" title="Reputation">
            Create-time host, suffix, and exact-URL blocklist screening. Redirects
            skip list rechecks so a later list update cannot break an old link.
          </TrailPoint>
        </div>

        <p>
          Strictness has a cost. An unusual local or development URL can be
          rejected, and any blocklist can produce a false positive. The
          compensating controls are the explicit error classes, the create-only
          blocklist check, and the ability to run the service with a different
          list set.
        </p>
      </ArticleSection>

      {/* 03 / CLEANING */}
      <ArticleSection
        id="cleaning"
        mark="03 / cleaning"
        eyebrow="remove first, shorten second"
        title="Cleaning is a compiled rules pipeline, not a list of guesses."
        figure={<RedirectChainDiagram />}
      >
        <p>
          URLs accumulate campaign tags, ad identifiers, search state, redirect
          wrappers, and site-specific query data. Some of that is useful to the
          destination; a large part is attribution or interface state that
          survives only because nobody removed it.
        </p>

        <div
          className="grid gap-px border sm:grid-cols-2"
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "var(--color-border)",
          }}
        >
          <TrailPoint number="01" title="Added by marketers">
            UTM parameters describe campaigns, sources, and mediums for
            attribution systems.
          </TrailPoint>
          <TrailPoint number="02" title="Added by ad platforms">
            Click identifiers such as `gclid` and `fbclid` connect a visit to an
            advertisement.
          </TrailPoint>
          <TrailPoint number="03" title="Added by the site">
            Shops and search engines append ranking, recommendation, and
            interface state of their own.
          </TrailPoint>
          <TrailPoint number="04" title="Added between sites">
            Redirect services introduce another request before the destination
            loads.
          </TrailPoint>
        </div>

        <p>
          Lynky compiles ClearURLs and its own tracker rules into{" "}
          <b style={{ color: "var(--color-ink)" }}>about 200 providers</b> and{" "}
          <b style={{ color: "var(--color-ink)" }}>roughly 950 rule entries</b>.
          Provider order is preserved. A host index selects candidates, a
          fallback bucket keeps unmatched patterns available, and the original
          provider regex is still the final authority. The index is a prefilter,
          never an authorization shortcut. Rules compile into exact sets, prefix
          arrays, and regex arrays; duplicate and overlap reports are produced at
          build time, provider order is preserved, and the allowlist is checked
          before every removal path.
        </p>

        <TwoJobsFigure />

        <p>
          Wrapper unwrapping happens before ordinary parameter removal. Known
          redirect parameters are unwrapped recursively within a bounded depth,
          then the cleaner returns to the final destination. Provider rules,
          referral rules, raw URL rules, global tracker groups, allowlists, and
          exceptions each have a defined stage. The allowlist is checked before
          every removal path, because a `v` on YouTube or a `tag` on Amazon is
          functional data, not tracking noise.
        </p>

        <p>
          Cleaning happens before shortening for a simple reason: the short code
          should point to the destination Lynky actually wants to preserve, not
          to a wrapper that hides the noisy URL. The result is what gets hashed,
          encrypted, and stored.
        </p>

        <h3
          className="mt-4 text-lg sm:text-xl"
          style={{ ...display, color: "var(--color-ink)", fontWeight: 500 }}
        >
          One real request: a tracked link
        </h3>

        <p>
          The teardown example contains a destination, a page route, and a large
          amount of campaign and attribution context in the same string. The
          useful identity is the route; the surrounding context is not required
          for the page to resolve.
        </p>

        <UrlTeardownFigure />

        <p>
          The parameter names come from common tracking conventions rather than
          any single platform's private schema, so the labels below describe
          what these fields generally carry.
        </p>

        <ParamLedger />

        <p>
          Remove the unnecessary context and the same destination can be
          represented much more simply:
        </p>

        <CleanResult />
      </ArticleSection>

      {/* 04 / SHORTENING */}
      <ArticleSection
        id="shortening"
        mark="04 / shortening"
        eyebrow="from a clean URL to a short code"
        title="The clean URL becomes a keyed dedupe hash and a recoverable code."
        figure={<CreateFlowFigure />}
      >
        <p>
          The cleaned destination is hashed with a keyed HMAC-SHA-256 and stored
          as a unique `urlHash`. That makes dedupe deterministic without turning
          a leaked database into an offline URL confirmation oracle. The short
          code is also hashed with HMAC-SHA-256 and stored as `codeHash`; neither
          hash is a bare digest that can be tested without the server key.
        </p>

        <div
          className="grid gap-px border sm:grid-cols-3"
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "var(--color-border)",
          }}
        >
          <Field
            label="urlHash"
            value="HMAC-SHA-256(cleaned URL)"
            note="Unique dedupe key. Same cleaned destination maps to one row."
          />
          <Field
            label="codeSalt"
            value="16 random bytes"
            note="Per-row recovery salt. Not secret on its own; it makes each derivation unique."
          />
          <Field
            label="codeHash"
            value="HMAC-SHA-256(short code)"
            note="Only the keyed hash is stored. The plaintext code is returned once."
          />
        </div>

        <p>
          A short code is derived from the URL hash and a random per-row salt:
          the configured 4–6 character code comes from a versioned HMAC input
          built from `urlHash` and `codeSalt`. A create inserts `codeSalt` and
          `codeHash`, but never the plaintext code. A unique `codeHash` index and
          a unique `urlHash` index make the database enforce both dedupe and code
          uniqueness.
        </p>

        <p>
          The 16-byte salt is what makes per-row recovery safe. The server can
          re-derive the code from the stored salt and URL hash, but the salt
          alone does not reveal the code, and the plaintext code never needs to be
          stored. A database dump without the server key cannot reconstruct the
          derivation.
        </p>

        <p>
          A repeat shorten request finds the unexpired matching row by `urlHash`,
          re-derives the same code, and refreshes `expiresAt`. Redirecting alone
          does not renew the record. If the row has expired and been deleted, a
          new shorten operation creates a new row with a new salt and a new
          code; the old short URL is not revived.
        </p>

        <p>
          If a derived code collides on `codeHash`, the insert fails, the server
          generates a new salt, and retries up to the configured attempt limit.
          The winning salt is stored with the row so future adoption remains
          stable even if Redis loses its cache. Pre-`codeSalt` rows keep the old
          Redis mapping fallback until they expire; they are not rotated merely
          to add a salt.
        </p>
      </ArticleSection>

      {/* 05 / STORAGE */}
      <ArticleSection
        id="storage"
        mark="05 / storage"
        eyebrow="what is kept, and what is not"
        title="The database keeps enough to redirect and delete, not a history of browsing."
      >
        <p>
          A link row contains the encrypted destination, the keyed `urlHash`, the
          `codeHash`, the per-row `codeSalt`, aggregate visit counters, timestamps,
          and `expiresAt`. The destination is encrypted with AES-256-GCM; the
          redirect path decrypts it only in memory when serving the request. This
          deployment is configured for a three-day expiry.
        </p>

        <p>
          On redirect, the path code is hashed to `codeHash`, looked up in Mongo,
          decrypted in memory, re-checked against the stored-destination policy,
          and returned as a 302. Re-shortening an unexpired destination refreshes
          its `expiresAt`; redirecting alone does not renew the record.
        </p>

        <div
          className="grid gap-px border sm:grid-cols-2"
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "var(--color-border)",
          }}
        >
          <div className={FIELD_CARD}>
            <span
              className="text-[9px] uppercase tracking-[0.16em]"
              style={{ ...mono, color: "var(--color-clean)" }}
            >
              stored
            </span>
            <ul
              className="mt-3 space-y-2 text-xs leading-relaxed sm:text-sm"
              style={{ ...body, color: "var(--color-ink-soft)" }}
            >
              <li>Encrypted destination (`AES-256-GCM`)</li>
              <li>Keyed `urlHash`, `codeHash`, and `codeSalt`</li>
              <li>Aggregate `visitCount` / `lastVisitedAt`</li>
              <li>Global link, redirect, and click totals</li>
              <li>Route-level metrics and error records</li>
              <li>Admin sessions and CSRF state</li>
            </ul>
          </div>

          <div className={FIELD_CARD}>
            <span
              className="text-[9px] uppercase tracking-[0.16em]"
              style={{ ...mono, color: "var(--color-dirty)" }}
            >
              not stored
            </span>
            <ul
              className="mt-3 space-y-2 text-xs leading-relaxed sm:text-sm"
              style={{ ...body, color: "var(--color-ink-soft)" }}
            >
              <li>Plaintext short codes or plaintext destinations</li>
              <li>Raw URL paths, query strings, or fragments in logs/metrics</li>
              <li>Tracking cookies, advertising identifiers, or per-click event history</li>
              <li>Raw IP addresses as application data</li>
              <li>Per-click records for dashboard display</li>
              <li>Per-user browsing histories</li>
            </ul>
          </div>
        </div>

        <p>
          Metrics are aggregate rollups: minute buckets in Redis flush into
          minute (7 days), hour (90 days), and daily/monthly (kept) Mongo records;
          error logs are kept for 90 days. Error records contain a route, status,
          error code, request ID, and a generic message. They do not contain the
          destination or query string. The global limit uses one shared hourly
          counter rather than per-IP keys; admin lockout counters use hashed
          identity values in Redis only.
        </p>
      </ArticleSection>

      {/* 06 / REDIRECT */}
      <ArticleSection
        id="redirect"
        mark="06 / redirect"
        eyebrow="hot links, cache, and click accounting"
        title="Hot links stay in cache; every attempt is counted."
        figure={<RedirectCacheFigure />}
      >
        <p>
          A redirect starts by validating the short-code shape. Impossible codes
          fail before any cache or database lookup, but they still count as a
          failed attempt because the request reached the application.
        </p>

        <p>
          The cache path has separate layers. The browser and CDN can reuse a
          previously cached not-found response; a local negative cache
          absorbs repeated false-code scans; Redis serves the hot-link entry; and
          Mongo is the cold authority. Click accounting runs alongside the
          redirect rather than blocking it. A newly created code clears its local
          negative marker, so an earlier 404 cannot shadow it for the negative
          cache lifetime.
        </p>

        <p>
          Hot detection uses the current and previous five-minute buckets, with a
          ten-minute key TTL, so the trigger is four visits in the combined
          rolling window. Hot entries default to a 15-minute sliding TTL, capped
          by `expiresAt`; no clicks for 15 minutes means the cache entry
          disappears. The local negative cache is a bounded process-local
          thirty-second map, not shared Redis persistence. Cache invalidation is
          synchronous when a `codeHash` rotates; stable adoption can invalidate
          in the background. Cold visits write the per-link counter through while
          global attempts buffer in Redis. Hybrid mode flushes pending clicks
          every ten attempts or sixty seconds from the request path; exact mode
          writes through immediately, and dynamic mode chooses based on current
          traffic. Pending buffers have a 24-hour TTL.
        </p>

        <p>
          Counters are approximate by design. A pending buffer can be lost if
          Redis is evicted before a flush, and the dashboard may briefly trail
          the real total. That latency is the price of keeping Mongo writes off
          the redirect path. If Redis is down, redirects continue through Mongo
          or the in-memory fallback; counting failure never becomes a redirect
          failure.
        </p>

        <div
          className="grid gap-px border sm:grid-cols-2"
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "var(--color-border)",
          }}
        >
          <TrailPoint number="01" title="Negative cache">
            Repeated false codes are remembered locally for 30 seconds, so a
            scanner cannot force a Mongo lookup on every retry.
          </TrailPoint>
          <TrailPoint number="02" title="Redis hot path">
            A hot link is served from Redis without touching MongoDB. Cache
            lifetime is capped by the link&apos;s remaining expiry.
          </TrailPoint>
          <TrailPoint number="03" title="Mongo cold path">
            Cache misses and Redis outages fall back to a Mongo lookup, stock
            validation, decryption, and policy re-checks.
          </TrailPoint>
          <TrailPoint number="04" title="Click accounting">
            Attempts, successful 302s, and failures are separate counters.
            Successful redirects stay `no-store`, so every success reaches the
            app and is counted.
          </TrailPoint>
        </div>
      </ArticleSection>

      {/* 07 / OPERATIONS */}
      <ArticleSection
        id="operations"
        mark="07 / operations"
        eyebrow="server handshake and public signals"
        title="The server publishes what it can verify."
      >
        <p>
          Startup runs the URL-validator smoke test, loads the compiled config,
          checks the blocklist state, initializes the cache, connects to Mongo,
          and verifies the link indexes. The server refuses to accept create
          traffic if the compiled config or unique indexes are not ready. A
          missing blocklist degrades readiness instead of silently pretending
          screening is active.
        </p>

        <div className="overflow-x-auto border" style={{ borderColor: "var(--color-border)" }}>
          <div
            className="grid min-w-140 grid-cols-[130px_1fr_130px] border-b px-4 py-3"
            style={{ borderColor: "var(--color-border)" }}
          >
            {["endpoint", "meaning", "cache"].map((label) => (
              <span
                key={label}
                className="text-[9px] uppercase tracking-[0.16em]"
                style={{ ...mono, color: "var(--color-ink-soft)" }}
              >
                {label}
              </span>
            ))}
          </div>

          {[
            ["/health", "Process liveness. No database work.", "not cached"],
            ["/ready", "Compiled config, blocklist, database, cache.", "not cached"],
            ["/status", "Online flag and unique links created.", "CDN 5s"],
            ["/stats", "Public aggregate click/link totals.", "CDN 30s"],
            ["404 / 410", "Browser redirect to the frontend not-found page.", "CDN 30s"],
            ["302 success", "Destination redirect.", "no-store"],
          ].map(([endpoint, meaning, cache]) => (
            <div
              key={endpoint}
              className="grid min-w-140 grid-cols-[130px_1fr_130px] border-b px-4 py-3 last:border-b-0"
              style={{ borderColor: "var(--color-border)" }}
            >
              <span className="text-xs" style={{ ...mono, color: "var(--color-ink)" }}>
                {endpoint}
              </span>
              <span className="text-xs leading-relaxed" style={{ ...body, color: "var(--color-ink-soft)" }}>
                {meaning}
              </span>
              <span className="text-[10px]" style={{ ...mono, color: "var(--color-ink-soft)" }}>
                {cache}
              </span>
            </div>
          ))}
        </div>

        <p>
          The home page shows two small signals from the same cached `/status`
          response: whether the server is connected, and how many unique links
          have been created. The link counter is not a click count. It increments
          only when a new row is created, not when an existing destination is
          deduped or refreshed. The API-key form uses the configured 45-character
          length on both the client and the server.
        </p>

        <p>
          Cache headers are restricted to responses where they are safe. `/status`
          uses a five-second CDN freshness window; `/stats` uses thirty seconds;
          browser 404/410 responses are cacheable for thirty seconds and vary on
          `Accept`. A successful 302 is always `no-store`.
        </p>
      </ArticleSection>

      {/* 08 / CAPACITY */}
      <ArticleSection
        id="capacity"
        mark="08 / capacity"
        eyebrow="why the numbers look like this"
        title="Capacity is a budget, not a CPU headline."
        figure={<CapacityFigure />}
      >
        <p>
          The backend is designed around a five-thousand-request-per-hour global
          budget. That limit applies to every route, not just creation. CDN caching
          absorbs repeated status, stats, and not-found traffic before it reaches
          the origin. The Redis counter is shared across instances when Redis is
          configured; otherwise the in-memory fallback keeps the limiter working
          per process.
        </p>

        <p>
          The design also assumes a small deployment: limited function memory and
          execution time, edge and function limits, a Redis instance with roughly
          a 25–30 MB working budget, and a MongoDB budget of roughly 512 MB in the
          current small/free-tier assumption. Those constraints shape the
          compiled blocklist, the 640-character input cap, the cache layers, and
          the decision to aggregate metrics instead of storing every request.
        </p>

        <div
          className="grid gap-px border sm:grid-cols-2"
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "var(--color-border)",
          }}
        >
          <Field
            label="compiled blocklist"
            value="over 1.1M hosts"
            note="Six curated lists compiled into one binary index, plus a smaller exact-URL set. About 12 MB."
          />
          <Field
            label="blocklist lookup"
            value="1.62 µs p99"
            note="Local benchmark; load time about 5.3 ms."
          />
          <Field
            label="full clean"
            value="9 µs p99"
            note="Local compiled cleaner benchmark, not end-to-end latency."
          />
          <Field
            label="boot / cold start"
            value="119 MB RSS · 177 ms"
            note="Local cold-start proxy; platform numbers require staging."
          />
        </div>

        <p>
          Creation has a separate limiter, API usage reads have their own smaller
          limiter, and BotID plus Vercel Firewall add pre-application filtering.
          Those are protective layers, not a promise that every legitimate burst
          fits. A shared hourly budget can reject a sudden crowd even when each
          request is valid.
        </p>

        <p>
          The local benchmark is useful for comparing the compiled cleaner, the
          blocklist artifact, and the request path against each other. It is not
          a platform capacity result. Exact serverless throughput, cold-start
          distribution, Redis bandwidth, and Mongo behavior require a staging
          load test with the real deployment shape.
        </p>
      </ArticleSection>

      {/* 09 / CLIENT STATE */}
      <ArticleSection
        id="client-state"
        mark="09 / client state"
        eyebrow="what the browser keeps"
        title="The browser keeps only what it needs for the next request."
      >
        <p>
          Lynky has no analytics or tracking cookie. The public site does not set
          a cookie just to remember a visit. The admin area is different: login
          creates an opaque Mongo-backed session, and the browser receives an
          `HttpOnly`, `Secure` in production, `SameSite=Strict` cookie. The
          session slides for 30 minutes with an 8-hour absolute cap, and session
          data stays in Mongo rather than Redis.
        </p>

        <div className="overflow-x-auto border" style={{ borderColor: "var(--color-border)" }}>
          {[
            ["API secret", "React memory only", "A refresh or tab restore requires re-entry."],
            ["Status/stats cache", "sessionStorage + memory", "Non-sensitive totals with a short TTL."],
            ["Invalid-code marker", "sessionStorage", "Remembers a 404 code for optional UX."],
            ["Admin session", "HttpOnly cookie", "Opaque ID; Mongo stores only its hash."],
          ].map(([name, where, note]) => (
            <div
              key={name}
              className="grid border-b px-4 py-4 last:border-b-0 sm:grid-cols-[170px_190px_1fr]"
              style={{ borderColor: "var(--color-border)" }}
            >
              <span className="text-sm" style={{ ...body, color: "var(--color-ink)", fontWeight: 600 }}>
                {name}
              </span>
              <span className="mt-1 text-xs sm:mt-0" style={{ ...mono, color: "var(--color-clean)" }}>
                {where}
              </span>
              <span className="mt-2 text-xs leading-relaxed sm:mt-0" style={{ ...body, color: "var(--color-ink-soft)" }}>
                {note}
              </span>
            </div>
          ))}
        </div>

        <p>
          The API secret is intentionally not persisted. It exists in React state
          while the usage page is mounted; closing or refreshing the page forces
          re-entry. The status cache and invalid-code marker are transient UX
          state, not identity or tracking data.
        </p>
      </ArticleSection>

      {/* 10 / WHY */}
      <ArticleSection
        id="why"
        mark="10 / why this approach"
        eyebrow="what the architecture buys"
        title="Source-available behavior is easier to verify than a privacy promise."
        figure={<ArchitectureFigure />}
      >
        <p>
          Lynky combines cleaning and shortening in one source-available service.
          The value is not a longer feature list; it is the ability to inspect the
          rules, validation order, storage model, and cache behavior instead of
          inferring them from a marketing page.
        </p>

        <p>
          The implementation is source-available, so the rules, validation order,
          encryption, code derivation, retention, and cache behavior can be read
          directly. The service removes URL-level noise, avoids identity tracking,
          keeps records temporary, and does not build a per-click event history
          for display.
        </p>

        <p>
          The limits are part of the design. Lynky does not scan the destination
          page, does not make the browser anonymous, and cannot control what a
          destination logs or sets after the redirect. A destination that changes
          after validation can behave differently from the version that was
          checked. Those are boundaries, not bugs hidden behind copy.
        </p>

        <h3
          className="mt-4 text-lg sm:text-xl"
          style={{ ...display, color: "var(--color-ink)", fontWeight: 500 }}
        >
          Sources and dependencies
        </h3>

        <div
          className="grid gap-px border sm:grid-cols-2"
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "var(--color-border)",
          }}
        >
          <Field
            label="tldts"
            value="public-suffix checks"
            note="Registrable-domain and ICANN suffix validation."
          />
          <Field
            label="ipaddr.js"
            value="IP classification"
            note="IPv4/IPv6 range checks, including mapped and compatible forms."
          />
          <Field
            label="ClearURLs"
            value="tracker/provider rules"
            note="Community-maintained cleaning data compiled into the provider set."
          />
          <Field
            label="HaGeZi"
            value="domain blocklists"
            note="Light, NSFW, gambling, and URL-shortener lists."
          />
          <Field
            label="Phishing Army"
            value="phishing domains"
            note="Create-time phishing domain screening."
          />
          <Field
            label="abuse.ch URLhaus"
            value="malicious URL hostfile"
            note="Create-time malicious URL and host screening."
          />
          <Field
            label="Redis / ioredis"
            value="cache + counters"
            note="Hot links, rate-limit counters, click buffers, and metrics buckets."
          />
          <Field
            label="MongoDB / mongoose"
            value="durable records"
            note="Links, aggregate stats, metrics rollups, errors, and admin sessions."
          />
          <Field
            label="Vercel BotID + Firewall"
            value="selected routes"
            note="Pre-application bot and firewall checks where deployed."
          />
        </div>

        <p>
          These are curated sources, not a claim of total internet coverage. The
          blocklists are finite and can go stale; they are one layer of the
          acceptance path, not a complete internet filter.
        </p>

        <h3
          className="mt-4 text-lg sm:text-xl"
          style={{ ...display, color: "var(--color-ink)", fontWeight: 500 }}
        >
          Decision matrix
        </h3>

        <div className="overflow-x-auto border" style={{ borderColor: "var(--color-border)" }}>
          <div className="grid min-w-180 grid-cols-[130px_1fr_1fr_1fr] border-b px-4 py-3" style={{ borderColor: "var(--color-border)" }}>
            {["area", "choice", "why", "limit"].map((label) => (
              <span key={label} className="text-[9px] uppercase tracking-[0.14em]" style={{ ...mono, color: "var(--color-ink-soft)" }}>
                {label}
              </span>
            ))}
          </div>

          {[
            [
              "blocklist lookup",
              "MPHF + 64-bit verification + collision table; sorted-hash fallback",
              "Deterministic, no blocking false positives, small runtime index",
              "Build cost and a fallback mode to maintain",
            ],
            [
              "provider/rules",
              "host hints + fallback + original regex; exact/prefix/regex buckets",
              "Avoids scanning every provider while preserving order and correctness",
              "A missed hint falls into the fallback bucket",
            ],
            [
              "security/storage",
              "HMAC-SHA-256 hashes, 16-byte salt, AES-256-GCM ciphertext",
              "No plaintext code or destination; stable recovery; decrypt only on redirect",
              "Server + DB can re-derive a code; not anonymity",
            ],
            [
              "Redis/caching",
              "5m buckets, 4-visit hot threshold, 15m sliding TTL, local negative cache",
              "Lower latency and fewer Mongo writes; safe degraded path",
              "Approximate counters; pending buffers can be lost",
            ],
            [
              "metrics/ops",
              "minute buckets → request-path rollups; 7d/90d/forever/90d",
              "No per-request Mongo write and no raw URL data",
              "Eventual consistency and a possible final-bucket gap",
            ],
            [
              "limits",
              "5k/hour global, route limiters, CDN, Firewall/BotID",
              "Protects a small deployment from bursts",
              "Legitimate bursts and monitors consume the same budget",
            ],
          ].map(([area, choice, why, limit]) => (
            <div
              key={area}
              className="grid min-w-180 grid-cols-[130px_1fr_1fr_1fr] border-b px-4 py-3 last:border-b-0"
              style={{ borderColor: "var(--color-border)" }}
            >
              <span className="text-xs" style={{ ...mono, color: "var(--color-ink)" }}>{area}</span>
              <span className="text-xs leading-relaxed" style={{ ...body, color: "var(--color-ink)" }}>{choice}</span>
              <span className="text-xs leading-relaxed" style={{ ...body, color: "var(--color-ink-soft)" }}>{why}</span>
              <span className="text-xs leading-relaxed" style={{ ...body, color: "var(--color-ink-soft)" }}>{limit}</span>
            </div>
          ))}
        </div>

        <p>
          No probabilistic structure is used for security decisions. This
          architecture is tuned for controlled public-utility semantics, not
          anonymous transport; the boundary section states the remaining limits
          without repeating every mechanism.
        </p>
      </ArticleSection>

      {/* 11 / BOUNDARY */}
      <ArticleSection
        id="boundary"
        mark="11 / boundary"
        eyebrow="what cleaning cannot promise"
        title="A cleaner link is not an anonymous browser."
        figure={<BoundaryFigure />}
      >
        <p>
          Lynky operates on the address. If attribution or tracking state is
          carried inside that address and matches a rule, Lynky can remove it. The
          destination server still receives the request and may log or count it;
          Lynky cannot make the visitor anonymous.
        </p>

        <p>
          Cleaning rules can go stale, strict validation can reject odd but valid
          destinations, and cached responses can briefly outlive a policy change.
          Shortener infrastructure can also be abused by bad actors. Filters are
          finite: there is no complete internet filter, and Lynky relies on the
          current curated lists rather than a guarantee of total coverage.
        </p>

        <div
          className="border"
          style={{
            borderColor: "var(--color-clean)",
            backgroundColor: "var(--color-clean-soft)",
          }}
        >
          <div
            className="border-b px-5 py-3"
            style={{
              borderColor:
                "color-mix(in srgb, var(--color-clean) 28%, transparent)",
            }}
          >
            <span
              className="text-[9px] uppercase tracking-[0.18em]"
              style={{ ...mono, color: "var(--color-clean)" }}
            >
              verify it yourself
            </span>
          </div>

          <div className="px-5 py-5">
            <p
              className="text-sm leading-relaxed"
              style={{ ...body, color: "var(--color-ink-soft)" }}
            >
              The API, cleaning rules, storage logic, and expiry behavior can be
              inspected directly rather than treated as claims hidden behind a
              privacy page.
            </p>

            <a
              href="https://github.com/Harshsanket/Lynky"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block text-xs underline underline-offset-4"
              style={{ ...mono, color: "var(--color-clean)" }}
            >
              github.com/Harshsanket/Lynky ↗
            </a>
          </div>
        </div>
      </ArticleSection>

      {/* APPENDIX / VERIFICATION */}
      <ArticleSection
        id="verification"
        mark="appendix / verification"
        eyebrow="what the tests cover"
        title="Tests on Lynky: security boundaries, pipeline invariants, and degraded paths."
      >
        <p>
          The tests back the claims in this article. They are organized by layer,
          not by marketing feature, and they deliberately separate security
          boundaries from ordinary functional checks.
        </p>

        <div className="overflow-x-auto border bg-white" style={{ borderColor: "var(--color-border)" }}>
          <div className="grid min-w-200 grid-cols-[140px_1fr_1fr_1fr] border-b px-4 py-3" style={{ borderColor: "var(--color-border)" }}>
            {["layer", "what it checks", "how it runs", "why it matters"].map((label) => (
              <span key={label} className="text-[9px] uppercase tracking-[0.14em]" style={{ ...mono, color: "var(--color-ink-soft)" }}>
                {label}
              </span>
            ))}
          </div>

          {[
            [
              "backend unit",
              "Validators, cleaners, hashing, code-salt recovery, env/config, blocklist parsing, own links",
              "Node.js test runner + tsx, fixtures, boundary cases, deterministic helpers",
              "Public claims must match code behavior, not manual checks",
            ],
            [
              "backend integration",
              "Mongo redirects, link lookup, click counters, metrics, stats cache, API-key quota, admin sessions",
              "Node.js test runner against a dedicated test Mongo DB; memory cache fallback",
              "Concurrency and persistence break without a real database",
            ],
            [
              "frontend",
              "URL pre-flight, API-key shape, status caching, deployment config",
              "Node.js test runner for src/lib tests",
              "The browser is untrusted, but its UX boundary and config parity should be verified",
            ],
            [
              "benchmarks",
              "Blocklist lookup, provider match, full clean, create/redirect/status/stats",
              "tinybench + autocannon, dev-only report artifacts",
              "Performance work needs a regression baseline",
            ],
            [
              "static checks",
              "TypeScript, ESLint, config schemas, audits, deterministic artifact compile",
              "CI + local npm scripts, tsc --noEmit, audit",
              "Catch cross-service drift before tests with real services",
            ],
            [
              "manual",
              "Create/copy, redirect, 404, mobile UI, admin dashboard",
              "Human checklist + browser flows",
              "Some UX and staging behavior is not represented by automated tests",
            ],
          ].map(([layer, what, how, why]) => (
            <div
              key={layer}
              className="grid min-w-200 grid-cols-[140px_1fr_1fr_1fr] border-b px-4 py-3 last:border-b-0"
              style={{ borderColor: "var(--color-border)" }}
            >
              <span className="text-xs" style={{ ...mono, color: "var(--color-ink)" }}>{layer}</span>
              <span className="text-xs leading-relaxed" style={{ ...body, color: "var(--color-ink)" }}>{what}</span>
              <span className="text-xs leading-relaxed" style={{ ...body, color: "var(--color-ink-soft)" }}>{how}</span>
              <span className="text-xs leading-relaxed" style={{ ...body, color: "var(--color-ink-soft)" }}>{why}</span>
            </div>
          ))}
        </div>

        <p>
          Privacy and security checks are separate from functional checks on
          purpose. The tests pin the redaction boundary, the absence of raw URL
          and query data in logs/metrics, aggregate-only click accounting, and the
          rule that the frontend never becomes the security authority.
        </p>

        <p>
          Locally, <code style={mono}>npm test</code> runs the backend and
          frontend suites without production secrets or production data.
          Mongo-backed integration tests skip when the configurable test URI is
          absent. CI performs typecheck, lint, build, config validation, golden
          checks, audits, and deployment-artifact checks.
        </p>

        <p>
          The tests do not guarantee behavior against every internet destination,
          do not replace the configured abuse limits or firewall, and do not prove
          third-party or destination-server behavior. They are not a 100% coverage
          claim. The test files live in{" "}
          <a
            href="https://github.com/Harshsanket/Lynky/tree/main/backend/tests"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
            style={{ ...mono, color: "var(--color-clean)" }}
          >
            backend/tests
          </a>{" "}
          and{" "}
          <a
            href="https://github.com/Harshsanket/Lynky/tree/main/frontend/src/lib"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
            style={{ ...mono, color: "var(--color-clean)" }}
          >
            frontend/src/lib
          </a>
          .
        </p>
      </ArticleSection>

      {/* APPENDIX / SHORTCUT */}
      <ArticleSection
        id="ios-shortcut"
        mark="appendix / shortcut"
        eyebrow="optional client"
        title="Set up Lynky as an iPhone Shortcut."
      >
        <p>
          On iOS 27 and later, Lynky can run through Apple Shortcuts. Once it is
          configured, send a link through the Shortcut and get the cleaned result
          without opening Lynky first.
        </p>

        <ShortcutSetup />

        <p>
          Do not rearrange the Shortcut actions. Enter your API key and leave the
          action order unchanged; remove only the notification action if you
          prefer silence.
        </p>

        <p>
          If you need help setting up the Shortcut or need an API key, contact{" "}
          <a
            href="mailto:harshsanket.dev@gmail.com"
            className="underline underline-offset-4 transition-opacity hover:opacity-60"
            style={{ ...mono, color: "var(--color-clean)" }}
          >
            harshsanket.dev@gmail.com
          </a>
          .
        </p>
      </ArticleSection>

      {/* END */}
      <footer
        className="grid border-t py-12 sm:grid-cols-[118px_1fr] sm:gap-10"
        style={{ borderColor: "var(--color-border)" }}
      >
        <span
          className="text-[10px] uppercase tracking-[0.16em]"
          style={{ ...mono, color: "var(--color-dirty)" }}
        >
          end / 001
        </span>

        <div className="mt-6 sm:mt-0">
          <p
            className="max-w-xl text-xl leading-snug sm:text-2xl"
            style={{ ...display, color: "var(--color-ink)", fontWeight: 500 }}
          >
            Keep the destination. Remove the trail. Shorten what remains.
          </p>

          <p
            className="mt-4 max-w-lg text-sm leading-relaxed"
            style={{ ...body, color: "var(--color-ink-soft)" }}
          >
            That is the whole Lynky pipeline in one sentence.
          </p>
        </div>
      </footer>
    </main>
  );
};

export default Blog;
