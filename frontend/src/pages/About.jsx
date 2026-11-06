/**
 * About — "A small tool with a deliberately big job."
 *
 * Editorial page; reusable rows/cards live in `src/components/about/`.
 */

import { Bug, Star } from "lucide-react";
import { mono, body, display } from "../lib/theme";
import Section from "../components/Section";
import LinkRow from "../components/about/LinkRow";
import Principle from "../components/about/Principle";
import ThanksRow from "../components/about/ThanksRow";

const THANKS = [
  {
    name: "ClearURLs",
    role: "rules",
    note: "For the community-maintained tracker and provider rules compiled into Lynky's cleaner.",
    url: "https://github.com/ClearURLs/Rules",
  },
  {
    name: "HaGeZi",
    role: "blocklists",
    note: "For the domain blocklists used for malware, phishing, NSFW, gambling, and URL-shortener screening.",
    url: "https://github.com/hagezi/dns-blocklists",
  },
  {
    name: "Phishing Army",
    role: "blocklists",
    note: "For the phishing domain blocklist screened at create time.",
    url: "https://phishing.army/",
  },
  {
    name: "URLhaus / abuse.ch",
    role: "blocklists",
    note: "For the malicious URL hostfile screened at create time.",
    url: "https://urlhaus.abuse.ch/",
  },
  {
    name: "Vercel",
    role: "infrastructure",
    note: "For hosting the frontend and backend.",
    url: "https://vercel.com",
  },
  {
    name: "MongoDB",
    role: "infrastructure",
    note: "For the database behind temporary link records.",
    url: "https://www.mongodb.com",
  },
  {
    name: "Redis",
    role: "infrastructure",
    note: "For the hot-link cache and rate-limit fallback.",
    url: "https://redis.io/",
  },
];

const About = () => {
  return (
    <main className="mx-auto w-full max-w-210 px-6 py-12 sm:px-8 sm:py-16">
      {/* HEADER */}
      <header className="pb-16 sm:pb-20">
        <div className="flex items-center gap-3">
          <span
            className="text-[10px] uppercase tracking-[0.2em]"
            style={{ ...mono, color: "var(--color-dirty)" }}
          >
            about lynky
          </span>

          <span className="h-px w-8" style={{ backgroundColor: "var(--color-border)" }} />

          <span className="text-[10px]" style={{ ...mono, color: "var(--color-ink-soft)" }}>
            project notes / 001
          </span>
        </div>

        <h1
          className="mt-6 max-w-170 text-[2.7rem] leading-[1.02] sm:text-[3.5rem]"
          style={{ ...display, color: "var(--color-ink)", fontWeight: 500 }}
        >
          A small tool with a deliberately big job.
        </h1>

        <p
          className="mt-6 max-w-xl text-base leading-relaxed sm:text-lg"
          style={{ ...body, color: "var(--color-ink-soft)" }}
        >
          Lynky cleans unnecessary tracking information from a URL, shortens what remains, keeps it
          briefly, and then deletes it. The project is independently built and maintained.
        </p>
      </header>

      {/* 01 / WHY */}
      <Section
        mark="01 / why"
        eyebrow="the reason it exists"
        title="This page is about the link itself."
      >
        <p>
          Internet privacy, consent, and enforcement differ across countries and regions. A shared
          link can carry campaign identifiers, referral strings, advertising IDs, analytics
          parameters, tracking tokens, and other metadata that has nothing to do with the page a
          person is trying to reach.
        </p>

        <p>
          Lynky cleans a link before it is shared, removes known and unnecessary parameters where it
          is safe to do so, and produces a short link containing only what is needed to redirect.
          The result is easier to read and share, less likely to expose unnecessary tracking
          information, and less likely to fill a conversation with an overlong URL or an unwanted
          automatic preview.
        </p>
      </Section>

      {/* 02 / MAKER */}
      <Section
        mark="02 / maker"
        eyebrow="behind the project"
        title="Proudly made in Mumbai by Harsh Sanket."
      >
        <p>
          I'm a software engineer based in Mumbai. Lynky is an independent project I build and
          maintain, with the cleaning and shortening path kept understandable enough to inspect.
        </p>

        <div
          className="border"
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "var(--color-bg-alt)",
          }}
        >
          <div className="p-5 sm:p-6">
            <span
              className="text-[9px] uppercase tracking-[0.18em]"
              style={{ ...mono, color: "var(--color-dirty)" }}
            >
              project / source
            </span>

            <p
              className="mt-3 max-w-md text-sm leading-relaxed"
              style={{ ...body, color: "var(--color-ink-soft)" }}
            >
              Lynky is an independent URL cleaner and shortener. Lynky is open source under GNU
              GPL v3.
            </p>
          </div>

          <div className="px-5 sm:px-6">
            <LinkRow
              label="license"
              value="GNU GPL v3"
              href="https://github.com/Harshsanket/Lynky/blob/main/LICENSE"
            />
            <LinkRow
              label="project"
              value="github.com/Harshsanket/Lynky"
              href="https://github.com/Harshsanket/Lynky"
            />
            <LinkRow
              label="maker"
              value="github.com/harshsanket"
              href="https://github.com/harshsanket"
            />
            <LinkRow
              label="x"
              value="@harshsanket1"
              href="https://x.com/harshsanket1"
            />
          </div>
        </div>
      </Section>

      {/* 03 / PRINCIPLES */}
      <Section
        mark="03 / principles"
        eyebrow="constraints by design"
        title="The project follows a few deliberate rules."
      >
        <p>
          Lynky is not trying to become an analytics platform, link management suite or advertising
          tool. Its constraints are part of the product.
        </p>

        <div
          className="grid gap-px border sm:grid-cols-2"
          style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-border)" }}
        >
          <Principle number="01" title="Do one job.">
            Clean the URL, shorten the useful result and stay out of the way.
          </Principle>

          <Principle number="02" title="Keep less.">
            Link records are temporary rather than a permanent history of what people have
            shortened.
          </Principle>

          <Principle number="03" title="Make claims inspectable.">
            Security and privacy claims should correspond to code someone can actually read.
          </Principle>

          <Principle number="04" title="Know the boundary.">
            URL cleaning can remove URL-level tracking. It should not be marketed as anonymity.
          </Principle>
        </div>
      </Section>

      {/* 04 / OPEN */}
      <Section
        mark="04 / open"
        eyebrow="source code"
        title="The implementation is part of the explanation."
      >
        <p>
          Lynky is source-available. The cleaning rules, API behavior, short-code generation,
          encryption, and expiry logic can be read directly.
        </p>

        <div
          className="border"
          style={{ borderColor: "var(--color-clean)", backgroundColor: "var(--color-clean-soft)" }}
        >
          <div className="grid sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="p-5 sm:p-6">
              <span className="text-[9px] uppercase tracking-[0.18em]" style={{ ...mono, color: "var(--color-clean)" }}>
                source
              </span>

              <p className="mt-4 text-lg sm:text-xl" style={{ ...display, color: "var(--color-ink)", fontWeight: 500 }}>
                Read the same code Lynky runs.
              </p>

              <p className="mt-3 max-w-md text-sm leading-relaxed" style={{ ...body, color: "var(--color-ink-soft)" }}>
                Run it locally, inspect a cleaning rule, report a bug, or submit a change.
              </p>
            </div>

            <a
              href="https://github.com/Harshsanket/Lynky"
              target="_blank"
              rel="noreferrer"
              className="border-t px-5 py-5 text-xs sm:border-l sm:border-t-0 sm:px-6"
              style={{
                ...mono,
                borderColor: "color-mix(in srgb, var(--color-clean) 30%, transparent)",
                color: "var(--color-clean)",
              }}
            >
              repository ↗
            </a>
          </div>
        </div>
      </Section>

      {/* 05 / THANKS */}
      <Section
        mark="05 / thanks"
        eyebrow="people, projects, infrastructure"
        title="The project still depends on a lot of other work."
      >
        <p>
          Lynky is maintained independently, but it was not created in isolation. These are some of
          the people, projects and services that helped make it possible.
        </p>

        <div className="border-y" style={{ borderColor: "var(--color-border)" }}>
          {THANKS.map((item, index) => (
            <ThanksRow key={item.name} index={index} {...item} />
          ))}
        </div>
      </Section>

      {/* 06 / GITHUB */}
      <Section
        mark="06 / github"
        eyebrow="source, issues, contributions"
        title="The repository is the project page."
      >
        <p>
          If Lynky is useful, star the repository. Found a bug? Open an issue.
        </p>

        <div
          className="grid gap-px border sm:grid-cols-2"
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "var(--color-border)",
          }}
        >
          <a
            href="https://github.com/Harshsanket/Lynky"
            target="_blank"
            rel="noreferrer"
            aria-label="Star Lynky on GitHub"
            className="group bg-(--color-bg-alt) p-5 transition-opacity hover:opacity-70 sm:p-6"
          >
            <Star
              className="h-5 w-5"
              fill="currentColor"
              style={{ color: "var(--color-clean)" }}
            />

            <p
              className="mt-4 text-base"
              style={{ ...display, color: "var(--color-ink)", fontWeight: 500 }}
            >
              Star the repository
            </p>

            <p
              className="mt-2 break-all text-xs"
              style={{ ...mono, color: "var(--color-ink-soft)" }}
            >
              github.com/Harshsanket/Lynky ↗
            </p>
          </a>

          <a
            href="https://github.com/Harshsanket/Lynky/issues"
            target="_blank"
            rel="noreferrer"
            aria-label="Open a Lynky issue on GitHub"
            className="group bg-(--color-bg-alt) p-5 transition-opacity hover:opacity-70 sm:p-6"
          >
            <Bug
              className="h-5 w-5"
              style={{ color: "var(--color-dirty)" }}
            />

            <p
              className="mt-4 text-base"
              style={{ ...display, color: "var(--color-ink)", fontWeight: 500 }}
            >
              Open an issue
            </p>

            <p
              className="mt-2 break-all text-xs"
              style={{ ...mono, color: "var(--color-ink-soft)" }}
            >
              github.com/Harshsanket/Lynky/issues ↗
            </p>
          </a>
        </div>
      </Section>

    </main>
  );
};

export default About;