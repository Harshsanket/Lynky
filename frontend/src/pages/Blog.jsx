import React from 'react';

const mono = { fontFamily: 'var(--font-mono)' };
const body = { fontFamily: 'var(--font-body)' };
const display = { fontFamily: 'var(--font-display)' };

const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';

const MOTION_STYLES = `
  @keyframes lynky-flow {
    to { stroke-dashoffset: -16; }
  }

  @keyframes lynky-fade-up {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes lynky-pulse {
    0%, 100% {
      opacity: .18;
      transform: scale(.94);
    }
    50% {
      opacity: .42;
      transform: scale(1);
    }
  }

  .lynky-flow-line {
    animation: lynky-flow 1.3s linear infinite;
  }

  .lynky-fade-up {
    animation: lynky-fade-up .65s ${EASE} both;
  }

  .lynky-pulse {
    animation: lynky-pulse 2.5s ${EASE} infinite;
    transform-origin: center;
  }

  @media (prefers-reduced-motion: reduce) {
    .lynky-flow-line,
    .lynky-fade-up,
    .lynky-pulse {
      animation: none !important;
    }
  }
`;

/* -------------------------------------------------------------------------- */
/*                                  LAYOUT                                    */
/* -------------------------------------------------------------------------- */

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
      style={{
        borderColor: 'var(--color-border)',
      }}
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
          className="max-w-2xl text-[1.7rem] leading-[1.12] sm:text-[2rem]"
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

function FigureFrame({
  index,
  title,
  note,
  children,
}) {
  return (
    <figure
      className="relative overflow-hidden border"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-bg-alt)',
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `
            linear-gradient(var(--color-ink) 1px, transparent 1px),
            linear-gradient(90deg, var(--color-ink) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
        }}
      />

      <header
        className="relative flex items-start justify-between gap-6 border-b px-5 py-4 sm:px-6"
        style={{
          borderColor: 'var(--color-border)',
        }}
      >
        <div>
          <span
            className="text-[9px] uppercase tracking-[0.2em]"
            style={{
              ...mono,
              color: 'var(--color-ink-soft)',
            }}
          >
            Fig. {index}
          </span>

          <h3
            className="mt-1 text-base sm:text-lg"
            style={{
              ...display,
              color: 'var(--color-ink)',
              fontWeight: 500,
            }}
          >
            {title}
          </h3>
        </div>

        {note && (
          <span
            className="hidden text-right text-[9px] uppercase leading-relaxed tracking-[0.14em] sm:block"
            style={{
              ...mono,
              color: 'var(--color-ink-soft)',
            }}
          >
            {note}
          </span>
        )}
      </header>

      <div className="relative">{children}</div>
    </figure>
  );
}

/* -------------------------------------------------------------------------- */
/*                                SECTION 01                                  */
/* -------------------------------------------------------------------------- */

function TrailPoint({
  number,
  title,
  children,
}) {
  return (
    <div
      className="bg-(--color-bg-alt) p-5 sm:p-6"
    >
      <span
        className="text-[10px]"
        style={{
          ...mono,
          color: 'var(--color-dirty)',
        }}
      >
        {number}
      </span>

      <h3
        className="mt-3 text-sm"
        style={{
          ...body,
          color: 'var(--color-ink)',
          fontWeight: 600,
        }}
      >
        {title}
      </h3>

      <p
        className="mt-2 text-xs leading-relaxed sm:text-sm"
        style={{
          ...body,
          color: 'var(--color-ink-soft)',
        }}
      >
        {children}
      </p>
    </div>
  );
}

function RedirectChainDiagram() {
  const nodes = [
    {
      label: 'source',
      detail: 'email / ad / post',
      color: 'var(--color-clean)',
    },
    {
      label: 'platform',
      detail: 'adds attribution',
      color: 'var(--color-dirty)',
    },
    {
      label: 'redirect',
      detail: 'another request',
      color: 'var(--color-dirty)',
    },
    {
      label: 'destination',
      detail: 'page finally loads',
      color: 'var(--color-ink)',
    },
  ];

  return (
    <FigureFrame
      index="01"
      title="The journey can be longer than the address suggests."
      note="request path"
    >
      <div className="overflow-x-auto px-5 py-8 sm:px-7">
        <svg
          viewBox="0 0 620 120"
          className="w-full min-w-130"
          aria-hidden="true"
        >
          <line
            x1="60"
            y1="55"
            x2="560"
            y2="55"
            stroke="var(--color-border)"
            strokeWidth="1.5"
          />

          <line
            className="lynky-flow-line"
            x1="60"
            y1="55"
            x2="560"
            y2="55"
            stroke="var(--color-dirty)"
            strokeWidth="1.5"
            strokeDasharray="5 7"
          />

          {nodes.map((node, index) => {
            const x = 60 + index * (500 / 3);

            return (
              <g key={node.label}>
                <circle
                  cx={x}
                  cy="55"
                  r="6"
                  fill="var(--color-bg-alt)"
                  stroke={node.color}
                  strokeWidth="1.5"
                />

                <text
                  x={x}
                  y="27"
                  textAnchor="middle"
                  style={{
                    ...mono,
                    fontSize: '10px',
                    fill: 'var(--color-ink)',
                  }}
                >
                  {node.label}
                </text>

                <text
                  x={x}
                  y="82"
                  textAnchor="middle"
                  style={{
                    ...body,
                    fontSize: '9px',
                    fill: 'var(--color-ink-soft)',
                  }}
                >
                  {node.detail}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </FigureFrame>
  );
}

/* -------------------------------------------------------------------------- */
/*                                SECTION 02                                  */
/* -------------------------------------------------------------------------- */

function TwoJobsFigure() {
  return (
    <FigureFrame
      index="02"
      title="Remove first. Compress second."
      note="two operations"
    >
      <div className="grid sm:grid-cols-2">
        <div
          className="border-b p-5 sm:border-b-0 sm:border-r sm:p-6"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <span
            className="text-[9px] uppercase tracking-[0.18em]"
            style={{
              ...mono,
              color: 'var(--color-dirty)',
            }}
          >
            01 / clean
          </span>

          <p
            className="mt-5 break-all text-xs leading-relaxed"
            style={{
              ...mono,
              color: 'var(--color-dirty)',
            }}
          >
            amazon.in/dp/B0FQFW4MVJ?crid=…&dib=…&qid=…&sr=8-3
          </p>

          <div
            className="my-5 h-px"
            style={{ backgroundColor: 'var(--color-border)' }}
          />

          <p
            className="break-all text-sm"
            style={{
              ...mono,
              color: 'var(--color-clean)',
            }}
          >
            amazon.in/dp/B0FQFW4MVJ
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <span
            className="text-[9px] uppercase tracking-[0.18em]"
            style={{
              ...mono,
              color: 'var(--color-clean)',
            }}
          >
            02 / shorten
          </span>

          <p
            className="mt-5 break-all text-sm"
            style={{
              ...mono,
              color: 'var(--color-clean)',
            }}
          >
            amazon.in/dp/B0FQFW4MVJ
          </p>

          <div
            className="my-5 h-px"
            style={{ backgroundColor: 'var(--color-border)' }}
          />

          <p
            className="text-lg"
            style={{
              ...mono,
              color: 'var(--color-ink)',
              fontWeight: 600,
            }}
          >
            short-lynky-hs.vercel.app/demo
          </p>
        </div>
      </div>
    </FigureFrame>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 TEARDOWN                                   */
/* -------------------------------------------------------------------------- */

const URL_PARTS = [
  {
    id: '01',
    label: 'protocol',
    value: 'https://',
    tone: 'neutral',
    note:
      'Defines how the browser communicates with the destination. It is structural, so Lynky leaves it alone.',
  },
  {
    id: '02',
    label: 'host',
    value: 'www.amazon.in',
    tone: 'neutral',
    note:
      'The destination site. This identifies where the request ultimately goes.',
  },
  {
    id: '03',
    label: 'product route',
    value: '/dp/B0FQFW4MVJ',
    tone: 'clean',
    note:
      'The useful part. The ASIN identifies the exact Amazon product page.',
  },
  {
    id: '04',
    label: 'attribution',
    value: '/ref=sr_1_3',
    tone: 'dirty',
    note:
      'Describes where the product was encountered. The product page does not need this to resolve.',
  },
  {
    id: '05',
    label: 'query string',
    value: '?crid=…&dib=…&keywords=…&qid=…&sprefix=…&sr=8-3&th=1',
    tone: 'dirty',
    note:
      'Search, ranking and interface context appended to the useful destination.',
  },
];

function toneColor(tone) {
  if (tone === 'clean') return 'var(--color-clean)';
  if (tone === 'dirty') return 'var(--color-dirty)';
  return 'var(--color-ink)';
}

function UrlTeardownFigure() {
  const [active, setActive] = React.useState(2);

  const part = URL_PARTS[active];

  return (
    <FigureFrame
      index="03"
      title="One link. Five different jobs."
      note="select a fragment"
    >
      <div className="px-5 py-8 sm:px-6 sm:py-10">
        <p
          className="break-all text-[13px] leading-[2.2] sm:text-[15px]"
          style={mono}
        >
          {URL_PARTS.map((item, index) => {
            const selected = index === active;
            const color = toneColor(item.tone);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(index)}
                className="inline border-b pb-1 text-left"
                style={{
                  color,
                  borderColor: selected ? color : 'transparent',
                  opacity: selected ? 1 : 0.45,
                  transition: `
                    opacity .3s ${EASE},
                    border-color .3s ${EASE}
                  `,
                }}
              >
                {item.value}
              </button>
            );
          })}
        </p>
      </div>

      <div
        className="grid border-t sm:grid-cols-[80px_150px_1fr]"
        style={{
          borderColor: 'var(--color-border)',
        }}
      >
        <div
          className="border-b px-5 py-5 sm:border-b-0 sm:border-r"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <span
            className="text-xs"
            style={{
              ...mono,
              color: toneColor(part.tone),
            }}
          >
            {part.id}
          </span>
        </div>

        <div
          className="border-b px-5 py-5 sm:border-b-0 sm:border-r"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <span
            className="text-[10px] uppercase tracking-[0.12em]"
            style={{
              ...mono,
              color: 'var(--color-ink)',
            }}
          >
            {part.label}
          </span>
        </div>

        <div className="px-5 py-5">
          <p
            className="text-sm leading-relaxed"
            style={{
              ...body,
              color: 'var(--color-ink-soft)',
            }}
          >
            {part.note}
          </p>
        </div>
      </div>

      <div
        className="grid grid-cols-5 border-t"
        style={{
          borderColor: 'var(--color-border)',
        }}
      >
        {URL_PARTS.map((item, index) => {
          const selected = index === active;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(index)}
              className="border-r px-2 py-3 last:border-r-0"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: selected
                  ? 'color-mix(in srgb, var(--color-ink) 4%, transparent)'
                  : 'transparent',
              }}
            >
              <span
                className="text-[9px]"
                style={{
                  ...mono,
                  color: selected
                    ? toneColor(item.tone)
                    : 'var(--color-ink-soft)',
                }}
              >
                {item.id}
              </span>
            </button>
          );
        })}
      </div>
    </FigureFrame>
  );
}

const PARAMS = [
  {
    name: 'ref=sr_1_3',
    purpose:
      'Attribution indicating this product was reached from a particular search-result position.',
  },
  {
    name: 'crid=4F9BF…',
    purpose:
      'An identifier associated with the search request that produced the result.',
  },
  {
    name: 'dib=eyJ2…',
    purpose:
      'Encoded search or recommendation context used internally by Amazon.',
  },
  {
    name: 'dib_tag=se',
    purpose:
      'A small flag associated with the encoded search context.',
  },
  {
    name: 'keywords=iphone+17+pro+max',
    purpose:
      'The search phrase that led to the product.',
  },
  {
    name: 'qid=1786806495',
    purpose:
      'An identifier associated with when the search request was produced.',
  },
  {
    name: 'sprefix=…',
    purpose:
      'Autocomplete and search-scope state carried from the search page.',
  },
  {
    name: 'sr=8-3',
    purpose:
      'Search-result positioning or ranking context.',
  },
  {
    name: 'th=1',
    purpose:
      'Interface or variant state. It is not needed to identify the product.',
  },
];

function ParamLedger() {
  return (
    <div
      className="border"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-bg-alt)',
      }}
    >
      <div
        className="grid px-4 py-3 sm:grid-cols-[170px_1fr]"
        style={{
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <span
          className="text-[9px] uppercase tracking-[0.16em]"
          style={{
            ...mono,
            color: 'var(--color-ink-soft)',
          }}
        >
          parameter
        </span>

        <span
          className="hidden text-[9px] uppercase tracking-[0.16em] sm:block"
          style={{
            ...mono,
            color: 'var(--color-ink-soft)',
          }}
        >
          what it appears to carry
        </span>
      </div>

      {PARAMS.map((param) => (
        <div
          key={param.name}
          className="grid border-t first:border-t-0 sm:grid-cols-[170px_1fr]"
          style={{
            borderColor: 'var(--color-border)',
          }}
        >
          <div
            className="px-4 py-4 sm:border-r"
            style={{
              borderColor: 'var(--color-border)',
            }}
          >
            <code
              className="break-all text-xs"
              style={{
                ...mono,
                color: 'var(--color-dirty)',
              }}
            >
              {param.name}
            </code>
          </div>

          <p
            className="px-4 pb-4 text-xs leading-relaxed sm:py-4 sm:text-sm"
            style={{
              ...body,
              color: 'var(--color-ink-soft)',
            }}
          >
            {param.purpose}
          </p>
        </div>
      ))}
    </div>
  );
}

function CleanResult() {
  return (
    <div
      className="border"
      style={{
        borderColor: 'var(--color-clean)',
        backgroundColor: 'var(--color-clean-soft)',
      }}
    >
      <div
        className="flex items-center justify-between gap-5 border-b px-5 py-3"
        style={{
          borderColor:
            'color-mix(in srgb, var(--color-clean) 30%, transparent)',
        }}
      >
        <span
          className="text-[9px] uppercase tracking-[0.18em]"
          style={{
            ...mono,
            color: 'var(--color-clean)',
          }}
        >
          clean destination
        </span>

        <span
          className="text-[9px]"
          style={{
            ...mono,
            color: 'var(--color-clean)',
          }}
        >
          ✓
        </span>
      </div>

      <p
        className="break-all px-5 py-6 text-sm sm:text-base"
        style={{
          ...mono,
          color: 'var(--color-clean)',
        }}
      >
        https://www.amazon.in/dp/B0FQFW4MVJ
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              IMPLEMENTATION                                */
/* -------------------------------------------------------------------------- */

function PipelineFigure() {
  const nodes = [
    {
      n: '01',
      label: 'clean',
      note: 'rules remove known noise',
      tone: 'dirty',
    },
    {
      n: '02',
      label: 'code',
      note: '4–6 character identifier',
      tone: 'neutral',
    },
    {
      n: '03',
      label: 'encrypt',
      note: 'AES-256-GCM',
      tone: 'neutral',
    },
    {
      n: '04',
      label: 'store',
      note: 'temporary record',
      tone: 'clean',
    },
    {
      n: '05',
      label: 'expire',
      note: 'deleted after 3 days',
      tone: 'clean',
    },
  ];

  return (
    <FigureFrame
      index="04"
      title="The short link is the end of a small pipeline."
      note="inside Lynky"
    >
      <div className="overflow-x-auto px-5 py-9 sm:px-6">
        <div className="flex min-w-150 items-stretch">
          {nodes.map((node, index) => {
            const color =
              node.tone === 'dirty'
                ? 'var(--color-dirty)'
                : node.tone === 'clean'
                  ? 'var(--color-clean)'
                  : 'var(--color-ink)';

            return (
              <React.Fragment key={node.n}>
                <div className="w-26.25 shrink-0 text-center">
                  <span
                    className="mx-auto flex h-8 w-8 items-center justify-center border text-[9px]"
                    style={{
                      ...mono,
                      borderColor: color,
                      color,
                    }}
                  >
                    {node.n}
                  </span>

                  <p
                    className="mt-3 text-xs"
                    style={{
                      ...mono,
                      color: 'var(--color-ink)',
                    }}
                  >
                    {node.label}
                  </p>

                  <p
                    className="mt-1 text-[10px] leading-relaxed"
                    style={{
                      ...body,
                      color: 'var(--color-ink-soft)',
                    }}
                  >
                    {node.note}
                  </p>
                </div>

                {index < nodes.length - 1 && (
                  <div className="mt-4 flex min-w-5.5 flex-1 items-start">
                    <div
                      className="h-px w-full"
                      style={{
                        backgroundColor: 'var(--color-border)',
                      }}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </FigureFrame>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  LIMITS                                    */
/* -------------------------------------------------------------------------- */

function BoundaryFigure() {
  return (
    <div
      className="grid border sm:grid-cols-2"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-bg-alt)',
      }}
    >
      <div
        className="border-b p-5 sm:border-b-0 sm:border-r sm:p-6"
        style={{
          borderColor: 'var(--color-border)',
        }}
      >
        <span
          className="text-[10px] uppercase tracking-[0.14em]"
          style={{
            ...mono,
            color: 'var(--color-clean)',
          }}
        >
          in the address
        </span>

        <h3
          className="mt-4 text-base"
          style={{
            ...display,
            color: 'var(--color-ink)',
            fontWeight: 500,
          }}
        >
          Lynky can remove this.
        </h3>

        <p
          className="mt-3 text-sm leading-relaxed"
          style={{
            ...body,
            color: 'var(--color-ink-soft)',
          }}
        >
          Known tracking parameters, click identifiers, attribution data,
          unnecessary query values and URL-level noise covered by the
          cleaning rules.
        </p>
      </div>

      <div className="p-5 sm:p-6">
        <span
          className="text-[10px] uppercase tracking-[0.14em]"
          style={{
            ...mono,
            color: 'var(--color-dirty)',
          }}
        >
          after the request
        </span>

        <h3
          className="mt-4 text-base"
          style={{
            ...display,
            color: 'var(--color-ink)',
            fontWeight: 500,
          }}
        >
          Lynky cannot remove this.
        </h3>

        <p
          className="mt-3 text-sm leading-relaxed"
          style={{
            ...body,
            color: 'var(--color-ink-soft)',
          }}
        >
          Destination-server logs, first-party cookies, account activity,
          browser fingerprinting or information collected after the page has
          loaded.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   PAGE                                     */
/* -------------------------------------------------------------------------- */

const Blog = () => {
  return (
    <main className="mx-auto w-full max-w-210 px-6 py-12 sm:px-8 sm:py-16">
      <style>{MOTION_STYLES}</style>

      {/* HEADER */}
      <header className="pb-16 sm:pb-20">
        <div className="flex items-center gap-3">
          <span
            className="text-[10px] uppercase tracking-[0.2em]"
            style={{
              ...mono,
              color: 'var(--color-dirty)',
            }}
          >
            how lynky works
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
            field notes / 001
          </span>
        </div>

        <h1
          className="mt-6 max-w-175 text-[2.6rem] leading-[1.03] sm:text-[3.4rem]"
          style={{
            ...display,
            color: 'var(--color-ink)',
            fontWeight: 500,
          }}
        >
          What happens to a link before Lynky gives it back.
        </h1>

        <p
          className="mt-6 max-w-xl text-base leading-relaxed sm:text-lg"
          style={{
            ...body,
            color: 'var(--color-ink-soft)',
          }}
        >
          A link can contain the page you wanted, the route you took to get
          there, and attribution data the destination does not need. Lynky
          separates those things, removes what it recognizes, then shortens
          what remains.
        </p>
      </header>

      {/* 01 */}
      <Section
        mark="01 / premise"
        eyebrow="where the extra data comes from"
        title="The destination is only one part of the link."
      >
        <p>
          Open a product, article or advertisement and the address can grow
          far beyond what the page actually needs. Some of that extra
          information describes where you came from, which campaign sent
          you, what you searched for or which result you clicked.
        </p>

        <div
          className="grid gap-px border sm:grid-cols-2"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-border)',
          }}
        >
          <TrailPoint
            number="01"
            title="Added by marketers"
          >
            UTM parameters describe campaigns, sources and mediums so
            analytics systems can attribute a visit.
          </TrailPoint>

          <TrailPoint
            number="02"
            title="Added by ad platforms"
          >
            Identifiers such as gclid and fbclid can connect the visit back
            to the advertisement that produced it.
          </TrailPoint>

          <TrailPoint
            number="03"
            title="Added by the site"
          >
            Shops and search engines often append query, ranking,
            recommendation and interface state of their own.
          </TrailPoint>

          <TrailPoint
            number="04"
            title="Added between sites"
          >
            Redirect services can introduce another HTTP request before you
            ever reach the final destination.
          </TrailPoint>
        </div>

        <RedirectChainDiagram />

        <p>
          Some of this information lives directly in the URL. Some does
          not. That distinction matters: Lynky can clean the address without
          pretending it controls what a destination does after you arrive.
        </p>
      </Section>

      {/* 02 */}
      <Section
        mark="02 / two jobs"
        eyebrow="remove first, compress second"
        title="Cleaning and shortening are different operations."
      >
        <p>
          Cleaning removes information that is not required to identify the
          destination. Shortening takes the clean destination and replaces
          it with a small temporary code.
        </p>

        <TwoJobsFigure />

        <p>
          Lynky does them in that order. It does not hide a noisy URL behind
          a short code and call it clean. The unnecessary parameters are
          removed first; the result is what gets shortened.
        </p>
      </Section>

      {/* 03 */}
      <Section
        mark="03 / trail"
        eyebrow="what happens on the way"
        title="Tracking can travel inside the address itself."
      >
        <p>
          Campaign parameters such as{' '}
          <code style={mono}>utm_source</code> and{' '}
          <code style={mono}>utm_campaign</code> are usually added so a
          visit can be attributed to a particular email, post or campaign.
        </p>

        <p>
          Advertising platforms can append their own click identifiers,
          such as <code style={mono}>gclid</code> or{' '}
          <code style={mono}>fbclid</code>. Those values travel with the URL
          rather than inside the browser's cookie jar.
        </p>

        <p>
          Sites can also add their own search, ranking, recommendation and
          session context. The result is often a link that still points to
          one simple resource but carries a large amount of surrounding
          state.
        </p>

        <div
          className="border-l-2 py-1 pl-5"
          style={{
            borderColor: 'var(--color-dirty)',
          }}
        >
          <p
            className="text-sm leading-relaxed"
            style={{
              ...body,
              color: 'var(--color-ink)',
            }}
          >
            URL cleaning addresses the information carried by the URL. It
            does not make the destination incapable of logging a request,
            setting a cookie or recognizing a signed-in account.
          </p>
        </div>
      </Section>

      {/* 04 */}
      <Section
        mark="04 / teardown"
        eyebrow="one real request"
        title="Take one Amazon link apart."
      >
        <p>
          A real example is more useful than a second generic anatomy
          lesson. This one contains the destination, the product identifier
          and a large amount of search and attribution context in the same
          string.
        </p>

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
              original
            </span>
          </div>

          <p
            className="break-all px-5 py-6 text-xs leading-[1.8]"
            style={{
              ...mono,
              color: 'var(--color-dirty)',
            }}
          >
            https://www.amazon.in/iPhone-Pro-Max-256-Promotion/dp/B0FQFW4MVJ/ref=sr_1_3?crid=4F9BFKW40LPH&dib=eyJ2IjoiMSJ9...&dib_tag=se&keywords=iphone%2B17%2Bpro%2Bmax&qid=1786806495&sprefix=iphone%2B17%2Bpro%2Bmax%2Caps%2C264&sr=8-3&th=1
          </p>
        </div>

        <UrlTeardownFigure />

        <p>
          The useful identity is much smaller than the full string. Amazon
          can resolve the product from its ASIN:
          <code
            className="ml-1"
            style={{
              ...mono,
              color: 'var(--color-clean)',
            }}
          >
            B0FQFW4MVJ
          </code>
          .
        </p>

        <p>
          Everything after the query separator carries additional context.
          Amazon does not publicly document every internal field, so the
          names below should be read as practical interpretations rather
          than an official schema.
        </p>

        <ParamLedger />

        <p>
          Remove the unnecessary context and the same useful destination can
          be represented much more simply:
        </p>

        <CleanResult />

        <p>
          That is the anatomy lesson and the teardown in the same example:
          structural pieces stay; unnecessary attribution and query context
          go.
        </p>
      </Section>

      {/* 05 */}
      <Section
        mark="05 / under hood"
        eyebrow="what happens after cleaning"
        title="The clean destination becomes a temporary record."
      >
        <p>
          Once the cleaner has produced the destination Lynky actually wants
          to preserve, a short code is generated and checked before the
          mapping is stored.
        </p>

        <PipelineFigure />

        <p>
          Stored destination data is encrypted at rest with{' '}
          <b style={{ color: 'var(--color-ink)' }}>AES-256-GCM</b>. Integrity
          checks use{' '}
          <b style={{ color: 'var(--color-ink)' }}>HMAC-SHA-256</b>, and
          short codes are randomly generated at{' '}
          <b style={{ color: 'var(--color-ink)' }}>4 to 6 characters</b>.
        </p>

        <p>
          Cleaning rules are based on the community-maintained{' '}
          <b style={{ color: 'var(--color-ink)' }}>ClearURLs</b> ruleset
          rather than a hand-maintained guess at which parameters look
          suspicious.
        </p>

        <div
          className="grid border sm:grid-cols-[1fr_auto]"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-bg-alt)',
          }}
        >
          <div className="p-5 sm:p-6">
            <span
              className="text-[9px] uppercase tracking-[0.18em]"
              style={{
                ...mono,
                color: 'var(--color-ink-soft)',
              }}
            >
              retention
            </span>

            <p
              className="mt-3 text-sm leading-relaxed"
              style={{
                ...body,
                color: 'var(--color-ink-soft)',
              }}
            >
              Every short-link record has a three-day lifetime.
            </p>
          </div>

          <div
            className="flex items-center border-t px-6 py-5 sm:border-l sm:border-t-0"
            style={{
              borderColor: 'var(--color-border)',
            }}
          >
            <span
              className="text-xl"
              style={{
                ...display,
                color: 'var(--color-clean)',
              }}
            >
              72h → deleted
            </span>
          </div>
        </div>

        <p>
          After expiry the record is deleted rather than kept indefinitely
          as historical link data.
        </p>
      </Section>

      {/* 06 */}
      <Section
        mark="06 / boundary"
        eyebrow="what cleaning cannot promise"
        title="A cleaner link is not an anonymous browser."
      >
        <p>
          Lynky operates on the address. If attribution or tracking state is
          carried inside that address and matches a cleaning rule, Lynky can
          remove it. It cannot control what happens once another server
          receives your request.
        </p>

        <BoundaryFigure />

        <p>
          That boundary is deliberate. A URL cleaner should make precise
          claims about what it changes rather than turning link hygiene into
          a general promise of anonymity.
        </p>

        <div
          className="border"
          style={{
            borderColor: 'var(--color-clean)',
            backgroundColor: 'var(--color-clean-soft)',
          }}
        >
          <div
            className="border-b px-5 py-3"
            style={{
              borderColor:
                'color-mix(in srgb, var(--color-clean) 28%, transparent)',
            }}
          >
            <span
              className="text-[9px] uppercase tracking-[0.18em]"
              style={{
                ...mono,
                color: 'var(--color-clean)',
              }}
            >
              verify it yourself
            </span>
          </div>

          <div className="px-5 py-5">
            <p
              className="text-sm leading-relaxed"
              style={{
                ...body,
                color: 'var(--color-ink)',
              }}
            >
              Lynky is open source. The API, cleaning rules, storage logic
              and expiry behavior can be inspected directly rather than
              treated as claims hidden behind a privacy page.
            </p>

            <a
              href="https://github.com/harshsanket/lynky"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block text-xs underline underline-offset-4"
              style={{
                ...mono,
                color: 'var(--color-clean)',
              }}
            >
              github.com/harshsanket/lynky ↗
            </a>
          </div>
        </div>
      </Section>

      {/* END */}
      <footer
        className="grid border-t py-12 sm:grid-cols-[118px_1fr] sm:gap-10"
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
          end / 001
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
            Keep the destination. Remove the trail. Shorten what remains.
          </p>

          <p
            className="mt-4 max-w-lg text-sm leading-relaxed"
            style={{
              ...body,
              color: 'var(--color-ink-soft)',
            }}
          >
            That is the whole Lynky pipeline in one sentence.
          </p>
        </div>
      </footer>
    </main>
  );
};

export default Blog;