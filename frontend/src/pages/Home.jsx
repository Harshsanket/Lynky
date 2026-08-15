import ServerStatus from '../components/ServerStatus';
import UrlCleaner from '../components/CleanLink';
import Feature from '../components/Feature';
import LinkCounter from '../components/LinkCounter';
import { CircleArrowOutUpRight, MoveUpRight } from 'lucide-react';

export default function Home() {
  return (
    <div className=" w-full" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Faint paper texture */}
      <div className="pointer-events-none fixed inset-0 paper-grain" />

      <div className="relative mx-auto flex  w-full max-w-3xl flex-col px-6 sm:px-8">
        {/* Hero */}
        <main className="flex flex-1 flex-col justify-center gap-10 py-12">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <ServerStatus />
              <LinkCounter />
              <a
                href="https://github.com/Harshsanket/Lynky"
                target="_blank"
                rel="noreferrer"
              >
                <span
                  className="flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs"
                  style={{
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-ink-soft)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  beta
                  <CircleArrowOutUpRight className="h-2.5 w-2.5" />
                </span>
              </a>
            </div>
            <h1
              className="text-4xl leading-[1.1] sm:text-5xl"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
              }}
            >
              Every link tells on you.
            </h1>

            <p
              className="max-w-xl text-base leading-relaxed sm:text-lg"
              style={{ color: 'var(--color-ink-soft)' }}
            >
              Trackers, session IDs, and referral tags ride along in every URL
              you share, and they usually make the link too long to look at
              twice. Lynky strips that out and shortens what's left, so the link
              you send is just the link.
            </p>
          </div>

          <UrlCleaner />

          {/* Features */}
          <div
            className="grid grid-cols-1 gap-8 border-t pt-10 sm:grid-cols-3"
            style={{ borderColor: 'var(--color-border)' }}
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
      </div>
    </div>
  );
}
