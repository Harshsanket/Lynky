/**
 * About — "A small tool with a deliberately small job."
 *
 * Editorial page; reusable rows/cards live in `src/components/about/`.
 */

import { mono, body, display } from "../lib/theme";
import Section from "../components/Section";
import Principle from "../components/about/Principle";
import LinkRow from "../components/about/LinkRow";
import ThanksRow from "../components/about/ThanksRow";

const THANKS = [
  {
    name: "Siddhesh Kumar",
    role: "friend / engineer",
    note: "For the debugging sessions, second opinions, and being around when something refused to work.",
  },
  {
    name: "Kevin Roebert",
    role: "ClearURLs",
    note: "For leading the ClearURLs project and maintaining the rules that Lynky builds its cleaning layer on.",
    url: "https://github.com/ClearURLs/Rules",
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
    name: "ChatGPT & DeepSeek",
    role: "tools",
    note: "Used as pair-programming tools during development.",
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
          A small tool with a deliberately small job.
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
        title="The link should just be a link."
      >
        <p>
          A shared address should primarily describe where someone is going. Instead, many URLs
          accumulate campaign tags, click identifiers, search state and other metadata that has
          little to do with the destination itself.
        </p>

        <p>
          Lynky started from a simple preference: remove the unnecessary parts before passing the
          link on.
        </p>

        <div className="border-l-2 py-1 pl-5" style={{ borderColor: "var(--color-clean)" }}>
          <p
            className="text-base leading-relaxed"
            style={{ ...display, color: "var(--color-ink)", fontWeight: 500 }}
          >
            Keep the destination. Remove the trail.
          </p>
        </div>
      </Section>

      {/* 02 / MAKER */}
      <Section
        mark="02 / maker"
        eyebrow="behind the project"
        title="Built and maintained by Harsh Sanket."
      >
        <p>
          I'm a software engineer based in Mumbai. Lynky is an independent project rather than a
          product built by a larger company or team.
        </p>

        <p>
          That means the same person writing the cleaner, API and storage logic is also responsible
          for keeping the project understandable enough for someone else to inspect.
        </p>

        <div
          className="border"
          style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-alt)" }}
        >
          <div className="border-b px-5 py-3" style={{ borderColor: "var(--color-border)" }}>
            <span className="text-[9px] uppercase tracking-[0.16em]" style={{ ...mono, color: "var(--color-ink-soft)" }}>
              coordinates
            </span>
          </div>

          <div className="px-5">
            <LinkRow
              label="github"
              value="github.com/harshsanket"
              href="https://github.com/harshsanket"
            />

            <LinkRow
              label="project"
              value="github.com/harshsanket/lynky"
              href="https://github.com/Harshsanket/Lynky"
            />
          </div>
        </div>
      </Section>

      {/* 03 / PRINCIPLES */}
      <Section
        mark="03 / principles"
        eyebrow="constraints by design"
        title="The project follows a few intentionally boring rules."
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
        eyebrow="nothing hidden behind copy"
        title="The implementation is part of the explanation."
      >
        <p>
          Lynky is open source. The cleaning rules, API behavior, short-code generation, encryption
          and expiry logic can be read directly instead of inferred from a marketing page.
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
        title="Small projects still depend on a lot of other work."
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

      {/* FOOTER */}
      <footer
        className="grid border-t py-12 sm:grid-cols-[118px_1fr] sm:gap-10"
        style={{ borderColor: "var(--color-border)" }}
      >
        <span className="text-[10px] uppercase tracking-[0.16em]" style={{ ...mono, color: "var(--color-dirty)" }}>
          end / about
        </span>

        <div className="mt-6 sm:mt-0">
          <p className="max-w-xl text-xl leading-snug sm:text-2xl" style={{ ...display, color: "var(--color-ink)", fontWeight: 500 }}>
            Built in Mumbai. Open on GitHub. Designed to disappear from the interaction as quickly
            as possible.
          </p>

          <p className="mt-4 text-[10px] uppercase tracking-[0.14em]" style={{ ...mono, color: "var(--color-ink-soft)" }}>
            lynky / independent software
          </p>
        </div>
      </footer>
    </main>
  );
};

export default About;