import React from 'react';
import { NavLink } from 'react-router';

const mono = { fontFamily: 'var(--font-mono)' };
const body = { fontFamily: 'var(--font-body)' };
const display = { fontFamily: 'var(--font-display)' };

function Section({
  mark,
  eyebrow,
  title,
  children,
}) {
  return (
    <section
      className="
        grid grid-cols-1
        border-t py-14
        sm:grid-cols-[118px_minmax(0,1fr)]
        sm:gap-10 sm:py-16
      "
      style={{ borderColor: 'var(--color-border)' }}
    >
      <aside className="mb-6 sm:mb-0">
        <div className="sm:sticky sm:top-24">
          <span
            className="block text-[10px] uppercase tracking-[0.16em]"
            style={{
              ...mono,
              color: 'var(--color-dirty)',
            }}
          >
            {mark}
          </span>

          {eyebrow && (
            <span
              className="mt-2 hidden max-w-25 text-[9px] uppercase leading-relaxed tracking-widest sm:block"
              style={{
                ...mono,
                color: 'var(--color-ink-soft)',
              }}
            >
              {eyebrow}
            </span>
          )}
        </div>
      </aside>

      <div className="min-w-0">
        <h2
          className="max-w-xl text-[1.7rem] leading-[1.12] sm:text-[2rem]"
          style={{
            ...display,
            color: 'var(--color-ink)',
            fontWeight: 500,
          }}
        >
          {title}
        </h2>

        <div
          className="
            mt-6 flex max-w-2xl flex-col gap-5
            text-[15px] leading-[1.75]
            sm:text-base
          "
          style={{
            ...body,
            color: 'var(--color-ink-soft)',
          }}
        >
          {children}
        </div>
      </div>
    </section>
  );
}

function CodeFrame() {
  return (
    <div
      className="overflow-hidden border"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-bg-alt)',
      }}
    >
      <div
        className="flex items-center justify-between gap-4 border-b px-5 py-3"
        style={{
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-[9px] uppercase tracking-[0.16em]"
            style={{
              ...mono,
              color: 'var(--color-dirty)',
            }}
          >
            POST
          </span>

          <span
            className="text-[10px]"
            style={{
              ...mono,
              color: 'var(--color-ink)',
            }}
          >
            /api/v1/urls
          </span>
        </div>

        <span
          className="hidden text-[9px] uppercase tracking-[0.14em] sm:block"
          style={{
            ...mono,
            color: 'var(--color-ink-soft)',
          }}
        >
          authenticated
        </span>
      </div>

      <div className="grid sm:grid-cols-[92px_1fr]">
        <div
          className="border-b px-5 py-4 sm:border-b-0 sm:border-r"
          style={{
            borderColor: 'var(--color-border)',
          }}
        >
          <span
            className="text-[9px] uppercase tracking-[0.13em]"
            style={{
              ...mono,
              color: 'var(--color-ink-soft)',
            }}
          >
            request
          </span>
        </div>

        <pre
          className="overflow-x-auto px-5 py-5 text-xs leading-[1.8]"
          style={{
            ...mono,
            color: 'var(--color-ink)',
          }}
        >
{`Authorization: Bearer <your-api-secret>
Content-Type: application/json

{
  "url": "https://example.com/?utm_source=x"
}`}
        </pre>
      </div>

      <div
        className="grid border-t sm:grid-cols-[92px_1fr]"
        style={{
          borderColor: 'var(--color-border)',
        }}
      >
        <div
          className="border-b px-5 py-4 sm:border-b-0 sm:border-r"
          style={{
            borderColor: 'var(--color-border)',
          }}
        >
          <span
            className="text-[9px] uppercase tracking-[0.13em]"
            style={{
              ...mono,
              color: 'var(--color-clean)',
            }}
          >
            response
          </span>
        </div>

        <pre
          className="overflow-x-auto px-5 py-5 text-xs leading-[1.8]"
          style={{
            ...mono,
            color: 'var(--color-clean)',
          }}
        >
{`{
  "success": true,
  "shortUrl": "https://short-lnky-hs.vercel.app/abc1"
}`}
        </pre>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  note,
  tone = 'neutral',
}) {
  const color =
    tone === 'clean'
      ? 'var(--color-clean)'
      : tone === 'dirty'
        ? 'var(--color-dirty)'
        : 'var(--color-ink)';

  return (
    <div
      className="
        grid border-t py-4
        first:border-t-0
        sm:grid-cols-[130px_150px_1fr]
        sm:items-baseline
        sm:gap-5
      "
      style={{
        borderColor: 'var(--color-border)',
      }}
    >
      <span
        className="text-[9px] uppercase tracking-[0.14em]"
        style={{
          ...mono,
          color: 'var(--color-ink-soft)',
        }}
      >
        {label}
      </span>

      <span
        className="mt-1 text-sm sm:mt-0"
        style={{
          ...mono,
          color,
        }}
      >
        {value}
      </span>

      <p
        className="mt-1 text-xs leading-relaxed sm:mt-0 sm:text-sm"
        style={{
          ...body,
          color: 'var(--color-ink-soft)',
        }}
      >
        {note}
      </p>
    </div>
  );
}

function AccessPanel() {
  return (
    <div
      className="border"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-bg-alt)',
      }}
    >
      <div
        className="border-b px-5 py-3"
        style={{
          borderColor: 'var(--color-border)',
        }}
      >
        <span
          className="text-[9px] uppercase tracking-[0.16em]"
          style={{
            ...mono,
            color: 'var(--color-ink-soft)',
          }}
        >
          access status
        </span>
      </div>

      <div className="grid sm:grid-cols-[1fr_auto]">
        <div className="p-5 sm:p-6">
          <span
            className="text-[10px] uppercase tracking-[0.14em]"
            style={{
              ...mono,
              color: 'var(--color-dirty)',
            }}
          >
            approval required
          </span>

          <h3
            className="mt-4 text-lg"
            style={{
              ...display,
              color: 'var(--color-ink)',
              fontWeight: 500,
            }}
          >
            API secrets are issued manually.
          </h3>

          <p
            className="mt-3 max-w-md text-sm leading-relaxed"
            style={{
              ...body,
              color: 'var(--color-ink-soft)',
            }}
          >
            For now, request access directly by email. Once approved, your
            secret can be used from scripts, apps, or iPhone Shortcuts.
          </p>

          <a
            href="mailto:harshsanket.dev@gmail.com"
            className="mt-5 inline-block text-xs underline underline-offset-4"
            style={{
              ...mono,
              color: 'var(--color-clean)',
            }}
          >
            harshsanket.dev@gmail.com
          </a>
        </div>

        <div
          className="
            flex min-w-42.5 flex-col justify-between
            border-t p-5
            sm:border-l sm:border-t-0
          "
          style={{
            borderColor: 'var(--color-border)',
          }}
        >
          <span
            className="text-[9px] uppercase tracking-[0.14em]"
            style={{
              ...mono,
              color: 'var(--color-ink-soft)',
            }}
          >
            monthly quota
          </span>

          <div className="mt-8">
            <span
              className="block text-3xl"
              style={{
                ...display,
                color: 'var(--color-ink)',
                fontWeight: 500,
              }}
            >
              10,000
            </span>

            <span
              className="mt-1 block text-[10px] uppercase tracking-[0.12em]"
              style={{
                ...mono,
                color: 'var(--color-ink-soft)',
              }}
            >
              links / month
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const API = () => {
  return (
    <main className="mx-auto w-full max-w-210 px-6 py-12 sm:px-8 sm:py-16">
      {/* -------------------------------------------------------------- */}
      {/* HEADER                                                         */}
      {/* -------------------------------------------------------------- */}

      <header className="pb-16 sm:pb-20">
        <div className="flex items-center gap-3">
          <span
            className="text-[10px] uppercase tracking-[0.2em]"
            style={{
              ...mono,
              color: 'var(--color-dirty)',
            }}
          >
            lynky api
          </span>

          <span
            className="h-px w-8"
            style={{
              backgroundColor: 'var(--color-border)',
            }}
          />

          <span
            className="text-[10px]"
            style={{
              ...mono,
              color: 'var(--color-ink-soft)',
            }}
          >
            interface / v1
          </span>
        </div>

        <h1
          className="
            mt-6 max-w-175
            text-[2.7rem] leading-[1.02]
            sm:text-[3.5rem]
          "
          style={{
            ...display,
            color: 'var(--color-ink)',
            fontWeight: 500,
          }}
        >
          Clean and shorten a link with one request.
        </h1>

        <p
          className="mt-6 max-w-xl text-base leading-relaxed sm:text-lg"
          style={{
            ...body,
            color: 'var(--color-ink-soft)',
          }}
        >
          Lynky exposes a small authenticated endpoint for developers,
          automations, and iPhone Shortcuts. Send a URL. Get a short link
          back.
        </p>
      </header>

      {/* -------------------------------------------------------------- */}
      {/* 01 / CONTRACT                                                   */}
      {/* -------------------------------------------------------------- */}

      <Section
        mark="01 / contract"
        eyebrow="one endpoint"
        title="The interface is intentionally small."
      >
        <p>
          The API accepts a URL, runs it through Lynky's cleaning pipeline,
          shortens the cleaned destination, and returns the resulting short
          URL.
        </p>

        <CodeFrame />

        <p>
          Authentication uses a bearer secret. The API does not need a
          separate SDK or client library; any environment capable of sending
          an HTTP request can use it.
        </p>
      </Section>

      {/* -------------------------------------------------------------- */}
      {/* 02 / DETAILS                                                    */}
      {/* -------------------------------------------------------------- */}

      <Section
        mark="02 / details"
        eyebrow="request characteristics"
        title="A small contract, with predictable limits."
      >
        <div
          className="border-y"
          style={{
            borderColor: 'var(--color-border)',
          }}
        >
          <DetailRow
            label="method"
            value="POST"
            note="Creates one cleaned and shortened URL."
          />

          <DetailRow
            label="endpoint"
            value="/api/v1/urls"
            note="Versioned API route for URL creation."
          />

          <DetailRow
            label="auth"
            value="Bearer secret"
            note="Pass the issued API secret in the Authorization header."
          />

          <DetailRow
            label="input"
            value='{ "url": "…" }'
            note="A single URL in the JSON request body."
          />

          <DetailRow
            label="output"
            value="shortUrl"
            tone="clean"
            note="The cleaned destination represented by a Lynky short URL."
          />

          <DetailRow
            label="quota"
            value="10,000 / month"
            tone="dirty"
            note="Applied per API secret."
          />
        </div>
      </Section>

      {/* -------------------------------------------------------------- */}
      {/* 03 / USE                                                       */}
      {/* -------------------------------------------------------------- */}

      <Section
        mark="03 / use"
        eyebrow="scripts, shortcuts, small tools"
        title="Use it anywhere you can make an HTTP request."
      >
        <p>
          The API is designed for small integrations rather than a large
          client ecosystem. A shell script, backend job, browser extension,
          personal automation, or iPhone Shortcut can all call the same
          endpoint.
        </p>

        <div
          className="grid gap-px border sm:grid-cols-3"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-border)',
          }}
        >
          <div className="bg-(--color-bg-alt) p-5">
            <span
              className="text-[9px]"
              style={{
                ...mono,
                color: 'var(--color-dirty)',
              }}
            >
              01
            </span>

            <h3
              className="mt-3 text-sm"
              style={{
                ...body,
                color: 'var(--color-ink)',
                fontWeight: 600,
              }}
            >
              Shortcuts
            </h3>

            <p
              className="mt-2 text-xs leading-relaxed"
              style={{
                ...body,
                color: 'var(--color-ink-soft)',
              }}
            >
              Share a URL into an iPhone Shortcut and replace it with the
              returned Lynky link.
            </p>
          </div>

          <div className="bg-(--color-bg-alt) p-5">
            <span
              className="text-[9px]"
              style={{
                ...mono,
                color: 'var(--color-dirty)',
              }}
            >
              02
            </span>

            <h3
              className="mt-3 text-sm"
              style={{
                ...body,
                color: 'var(--color-ink)',
                fontWeight: 600,
              }}
            >
              Scripts
            </h3>

            <p
              className="mt-2 text-xs leading-relaxed"
              style={{
                ...body,
                color: 'var(--color-ink-soft)',
              }}
            >
              Clean links from shell scripts, CLI tools, or personal
              workflows without opening the site.
            </p>
          </div>

          <div className="bg-(--color-bg-alt) p-5">
            <span
              className="text-[9px]"
              style={{
                ...mono,
                color: 'var(--color-dirty)',
              }}
            >
              03
            </span>

            <h3
              className="mt-3 text-sm"
              style={{
                ...body,
                color: 'var(--color-ink)',
                fontWeight: 600,
              }}
            >
              Apps
            </h3>

            <p
              className="mt-2 text-xs leading-relaxed"
              style={{
                ...body,
                color: 'var(--color-ink-soft)',
              }}
            >
              Use the endpoint as a small URL-cleaning primitive inside a
              larger application.
            </p>
          </div>
        </div>
      </Section>

      {/* -------------------------------------------------------------- */}
      {/* 04 / ACCESS                                                     */}
      {/* -------------------------------------------------------------- */}

      <Section
        mark="04 / access"
        eyebrow="private for now"
        title="Access is issued manually."
      >
        <p>
          API secrets are not self-service yet. Each secret is approved and
          issued directly before it can be used.
        </p>

        <AccessPanel />
      </Section>

      {/* -------------------------------------------------------------- */}
      {/* 05 / USAGE                                                      */}
      {/* -------------------------------------------------------------- */}

      <Section
        mark="05 / usage"
        eyebrow="already have a secret"
        title="Your quota lives on a separate usage page."
      >
        <p>
          If you already have an API key, use the usage page to check how
          much of the monthly allowance has been consumed.
        </p>

        <NavLink
          to="/api/usage"
          className="
            group grid border
            sm:grid-cols-[1fr_auto]
            sm:items-center
          "
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-bg-alt)',
          }}
        >
          <div className="p-5 sm:p-6">
            <span
              className="text-[9px] uppercase tracking-[0.16em]"
              style={{
                ...mono,
                color: 'var(--color-clean)',
              }}
            >
              member access
            </span>

            <h3
              className="mt-3 text-lg"
              style={{
                ...display,
                color: 'var(--color-ink)',
                fontWeight: 500,
              }}
            >
              Check API usage.
            </h3>

            <p
              className="mt-2 text-sm leading-relaxed"
              style={{
                ...body,
                color: 'var(--color-ink-soft)',
              }}
            >
              Enter your API secret and see the current monthly quota.
            </p>
          </div>

          <div
            className="
              flex items-center justify-between
              border-t px-5 py-4
              sm:min-w-36.25
              sm:border-l sm:border-t-0
              sm:px-6
            "
            style={{
              borderColor: 'var(--color-border)',
            }}
          >
            <span
              className="text-xs"
              style={{
                ...mono,
                color: 'var(--color-clean)',
              }}
            >
              open usage
            </span>

            <span
              className="
                ml-4 text-sm
                transition-transform
                group-hover:translate-x-1
              "
              style={{
                ...mono,
                color: 'var(--color-clean)',
              }}
            >
              →
            </span>
          </div>
        </NavLink>
      </Section>

      {/* -------------------------------------------------------------- */}
      {/* FOOTER                                                         */}
      {/* -------------------------------------------------------------- */}

      <footer
        className="
          grid border-t py-12
          sm:grid-cols-[118px_1fr]
          sm:gap-10
        "
        style={{
          borderColor: 'var(--color-border)',
        }}
      >
        <span
          className="text-[10px] uppercase tracking-[0.16em]"
          style={{
            ...mono,
            color: 'var(--color-dirty)',
          }}
        >
          end / api
        </span>

        <div className="mt-6 sm:mt-0">
          <p
            className="max-w-xl text-xl leading-snug sm:text-2xl"
            style={{
              ...display,
              color: 'var(--color-ink)',
              fontWeight: 500,
            }}
          >
            One URL in. One clean short link out.
          </p>

          <p
            className="mt-4 text-[10px] uppercase tracking-[0.14em]"
            style={{
              ...mono,
              color: 'var(--color-ink-soft)',
            }}
          >
            lynky / api v1
          </p>
        </div>
      </footer>
    </main>
  );
};

export default API;