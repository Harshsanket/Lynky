/**
 * Blog — "What happens to a link before Lynky gives it back."
 *
 * Content page; all figures and interactive diagrams live in
 * `src/components/blog/` and are composed here.
 */

import { mono, body, display } from "../lib/theme";
import Section from "../components/Section";
import TrailPoint from "../components/blog/TrailPoint";
import RedirectChainDiagram from "../components/blog/RedirectChainDiagram";
import TwoJobsFigure from "../components/blog/TwoJobsFigure";
import UrlTeardownFigure from "../components/blog/UrlTeardownFigure";
import ParamLedger from "../components/blog/ParamLedger";
import CleanResult from "../components/blog/CleanResult";
import PipelineFigure from "../components/blog/PipelineFigure";
import ShortcutSetup from "../components/blog/ShortcutSetup";
import BoundaryFigure from "../components/blog/BoundaryFigure";
import { MOTION_STYLES } from "../components/blog/constants";

const Blog = () => {
  return (
    <main className="mx-auto w-full max-w-210 px-6 py-12 sm:px-8 sm:py-16">
      <style>{MOTION_STYLES}</style>

      {/* HEADER */}
      <header className="pb-16 sm:pb-20">
        <div className="flex items-center gap-3">
          <span
            className="text-[10px] uppercase tracking-[0.2em]"
            style={{ ...mono, color: "var(--color-dirty)" }}
          >
            how lynky works
          </span>

          <span className="h-px w-8" style={{ backgroundColor: "var(--color-border)" }} />

          <span className="text-[10px]" style={{ ...mono, color: "var(--color-ink-soft)" }}>
            field notes / 001
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
          A link can contain the page you wanted, the route you took to get there, and attribution
          data the destination does not need. Lynky separates those things, removes what it
          recognizes, then shortens what remains.
        </p>
      </header>

      {/* 01 */}
      <Section
        mark="01 / premise"
        eyebrow="where the extra data comes from"
        title="The destination is only one part of the link."
      >
        <p>
          Open a product, article or advertisement and the address can grow far beyond what the
          page actually needs. Some of that extra information describes where you came from, which
          campaign sent you, what you searched for or which result you clicked.
        </p>

        <div
          className="grid gap-px border sm:grid-cols-2"
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "var(--color-border)",
          }}
        >
          <TrailPoint number="01" title="Added by marketers">
            UTM parameters describe campaigns, sources and mediums so analytics systems can
            attribute a visit.
          </TrailPoint>

          <TrailPoint number="02" title="Added by ad platforms">
            Identifiers such as gclid and fbclid can connect the visit back to the advertisement
            that produced it.
          </TrailPoint>

          <TrailPoint number="03" title="Added by the site">
            Shops and search engines often append query, ranking, recommendation and interface
            state of their own.
          </TrailPoint>

          <TrailPoint number="04" title="Added between sites">
            Redirect services can introduce another HTTP request before you ever reach the final
            destination.
          </TrailPoint>
        </div>

        <RedirectChainDiagram />

        <p>
          Some of this information lives directly in the URL. Some does not. That distinction
          matters: Lynky can clean the address without pretending it controls what a destination
          does after you arrive.
        </p>
      </Section>

      {/* 02 */}
      <Section
        mark="02 / two jobs"
        eyebrow="remove first, compress second"
        title="Cleaning and shortening are different operations."
      >
        <p>
          Cleaning removes information that is not required to identify the destination. Shortening
          takes the clean destination and replaces it with a small temporary code.
        </p>

        <TwoJobsFigure />

        <p>
          Lynky does them in that order. It does not hide a noisy URL behind a short code and call
          it clean. The unnecessary parameters are removed first; the result is what gets
          shortened.
        </p>
      </Section>

      {/* 03 */}
      <Section
        mark="03 / trail"
        eyebrow="what happens on the way"
        title="Tracking can travel inside the address itself."
      >
        <p>
          Campaign parameters such as <code style={mono}>utm_source</code> and{" "}
          <code style={mono}>utm_campaign</code> are usually added so a visit can be attributed to
          a particular email, post or campaign.
        </p>

        <p>
          Advertising platforms can append their own click identifiers, such as{" "}
          <code style={mono}>gclid</code> or <code style={mono}>fbclid</code>. Those values travel
          with the URL rather than inside the browser&apos;s cookie jar.
        </p>

        <p>
          Sites can also add their own search, ranking, recommendation and session context. The
          result is often a link that still points to one simple resource but carries a large
          amount of surrounding state.
        </p>

        <div className="border-l-2 py-1 pl-5" style={{ borderColor: "var(--color-dirty)" }}>
          <p className="text-sm leading-relaxed" style={{ ...body, color: "var(--color-ink-soft)" }}>
            URL cleaning addresses the information carried by the URL. It does not make the
            destination incapable of logging a request, setting a cookie or recognizing a signed-in
            account.
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
          A real example is more useful than a second generic anatomy lesson. This one contains the
          destination, the product identifier and a large amount of search and attribution context
          in the same string.
        </p>

        <div className="border" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-alt)" }}>
          <div className="border-b px-5 py-3" style={{ borderColor: "var(--color-border)" }}>
            <span className="text-[9px] uppercase tracking-[0.16em]" style={{ ...mono, color: "var(--color-ink-soft)" }}>
              original
            </span>
          </div>

          <p className="break-all px-5 py-6 text-xs leading-[1.8]" style={{ ...mono, color: "var(--color-dirty)" }}>
            https://www.amazon.in/iPhone-Pro-Max-256-Promotion/dp/B0FQFW4MVJ/ref=sr_1_3?crid=4F9BFKW40LPH&dib=eyJ2IjoiMSJ9...&dib_tag=se&keywords=iphone%2B17%2Bpro%2Bmax&qid=1786806495&sprefix=iphone%2B17%2Bpro%2Bmax%2Caps%2C264&sr=8-3&th=1
          </p>
        </div>

        <UrlTeardownFigure />

        <p>
          The useful identity is much smaller than the full string. Amazon can resolve the product
          from its ASIN:
          <code className="ml-1" style={{ ...mono, color: "var(--color-clean)" }}>
            B0FQFW4MVJ
          </code>
          .
        </p>

        <p>
          Everything after the query separator carries additional context. Amazon does not publicly
          document every internal field, so the names below should be read as practical
          interpretations rather than an official schema.
        </p>

        <ParamLedger />

        <p>
          Remove the unnecessary context and the same useful destination can be represented much
          more simply:
        </p>

        <CleanResult />

        <p>
          That is the anatomy lesson and the teardown in the same example: structural pieces stay;
          unnecessary attribution and query context go.
        </p>
      </Section>

      {/* 05 */}
      <Section
        mark="05 / under hood"
        eyebrow="what happens after cleaning"
        title="The clean destination becomes a temporary record."
      >
        <p>
          Once the cleaner has produced the destination Lynky actually wants to preserve, a short
          code is generated and checked before the mapping is stored.
        </p>

        <PipelineFigure />

        <p>
          Stored destination data is encrypted at rest with{" "}
          <b style={{ color: "var(--color-ink)" }}>AES-256-GCM</b>. Integrity checks use{" "}
          <b style={{ color: "var(--color-ink)" }}>HMAC-SHA-256</b>, and short codes are randomly
          generated at <b style={{ color: "var(--color-ink)" }}>4 to 6 characters</b>.
        </p>

        <p>
          Cleaning rules are based on the community-maintained{" "}
          <b style={{ color: "var(--color-ink)" }}>ClearURLs</b> ruleset rather than a
          hand-maintained guess at which parameters look suspicious.
        </p>

        <div
          className="grid border sm:grid-cols-[1fr_auto]"
          style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-alt)" }}
        >
          <div className="p-5 sm:p-6">
            <span className="text-[9px] uppercase tracking-[0.18em]" style={{ ...mono, color: "var(--color-ink-soft)" }}>
              retention
            </span>

            <p className="mt-3 text-sm leading-relaxed" style={{ ...body, color: "var(--color-ink-soft)" }}>
              Every short-link record has a three-day lifetime.
            </p>
          </div>

          <div
            className="flex items-center border-t px-6 py-5 sm:border-l sm:border-t-0"
            style={{ borderColor: "var(--color-border)" }}
          >
            <span className="text-xl" style={{ ...display, color: "var(--color-clean)" }}>
              72h → deleted
            </span>
          </div>
        </div>

        <p>After expiry the record is deleted rather than kept indefinitely as historical link data.</p>
      </Section>

      {/* 06 */}
      <Section
        id="ios-shortcut"
        mark="06 / shortcut"
        eyebrow="clean links straight from your iphone"
        title="Set up Lynky as an iPhone Shortcut."
      >
        <p>
          On <b style={{ color: "var(--color-ink)" }}>iOS 27 and later</b>, Lynky can run directly
          through Apple Shortcuts. Once it is set up, you can send a link through the Shortcut and
          get the cleaned result without opening Lynky first.
        </p>

        <ShortcutSetup />

        <div className="border-l-2 py-1 pl-5" style={{ borderColor: "var(--color-dirty)" }}>
          <p className="text-sm leading-relaxed" style={{ ...body, color: "var(--color-ink-soft)" }}>
            <b>Do not rearrange any of the actions.</b> The Shortcut is already wired correctly. You
            only need to enter your API key.
          </p>
        </div>

        <div
          className="grid border sm:grid-cols-2"
          style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-alt)" }}
        >
          <div
            className="border-b p-5 sm:border-b-0 sm:border-r sm:p-6"
            style={{ borderColor: "var(--color-border)" }}
          >
            <span className="text-[9px] uppercase tracking-[0.18em]" style={{ ...mono, color: "var(--color-clean)" }}>
              notifications
            </span>

            <h3 className="mt-3 text-base" style={{ ...display, color: "var(--color-ink)", fontWeight: 500 }}>
              You will know when it is done.
            </h3>

            <p className="mt-3 text-sm leading-relaxed" style={{ ...body, color: "var(--color-ink-soft)" }}>
              By default, the Shortcut shows a notification and plays a sound whenever Lynky
              finishes copying the result.
            </p>
          </div>

          <div className="p-5 sm:p-6">
            <span className="text-[9px] uppercase tracking-[0.18em]" style={{ ...mono, color: "var(--color-dirty)" }}>
              prefer silence?
            </span>

            <h3 className="mt-3 text-base" style={{ ...display, color: "var(--color-ink)", fontWeight: 500 }}>
              Remove only the notification action.
            </h3>

            <p className="mt-3 text-sm leading-relaxed" style={{ ...body, color: "var(--color-ink-soft)" }}>
              Find the <b style={{ color: "var(--color-ink)" }}>Show Notification</b> action and
              remove it using the <b style={{ color: "var(--color-ink)" }}>×</b> button. Leave every
              other action exactly where it is.
            </p>
          </div>
        </div>

        <div
          className="border p-5 sm:p-6"
          style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-alt)" }}
        >
          <span className="text-[9px] uppercase tracking-[0.18em]" style={{ ...mono, color: "var(--color-ink-soft)" }}>
            need help?
          </span>

          <p className="mt-3 text-sm leading-relaxed" style={{ ...body, color: "var(--color-ink-soft)" }}>
            If you need help setting up the Shortcut or need an API key, contact me at{" "}
            <a
              href="mailto:harshsanket.dev@gmail.com"
              className="underline underline-offset-4 transition-opacity hover:opacity-60"
              style={{ ...mono, color: "var(--color-clean)" }}
            >
              harshsanket.dev@gmail.com
            </a>
            .
          </p>
        </div>
      </Section>

      {/* 07 */}
      <Section
        mark="07 / boundary"
        eyebrow="what cleaning cannot promise"
        title="A cleaner link is not an anonymous browser."
      >
        <p>
          Lynky operates on the address. If attribution or tracking state is carried inside that
          address and matches a cleaning rule, Lynky can remove it. It cannot control what happens
          once another server receives your request.
        </p>

        <BoundaryFigure />

        <p>
          That boundary is deliberate. A URL cleaner should make precise claims about what it
          changes rather than turning link hygiene into a general promise of anonymity.
        </p>

        <div
          className="border"
          style={{ borderColor: "var(--color-clean)", backgroundColor: "var(--color-clean-soft)" }}
        >
          <div
            className="border-b px-5 py-3"
            style={{ borderColor: "color-mix(in srgb, var(--color-clean) 28%, transparent)" }}
          >
            <span className="text-[9px] uppercase tracking-[0.18em]" style={{ ...mono, color: "var(--color-clean)" }}>
              verify it yourself
            </span>
          </div>

          <div className="px-5 py-5">
            <p className="text-sm leading-relaxed" style={{ ...body, color: "var(--color-ink-soft)" }}>
              Lynky is open source. The API, cleaning rules, storage logic and expiry behavior can
              be inspected directly rather than treated as claims hidden behind a privacy page.
            </p>

            <a
              href="https://github.com/harshsanket/lynky"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block text-xs underline underline-offset-4"
              style={{ ...mono, color: "var(--color-clean)" }}
            >
              github.com/harshsanket/lynky ↗
            </a>
          </div>
        </div>
      </Section>

      {/* END */}
      <footer className="grid border-t py-12 sm:grid-cols-[118px_1fr] sm:gap-10" style={{ borderColor: "var(--color-border)" }}>
        <span className="text-[10px] uppercase tracking-[0.16em]" style={{ ...mono, color: "var(--color-dirty)" }}>
          end / 001
        </span>

        <div className="mt-6 sm:mt-0">
          <p className="max-w-xl text-xl leading-snug sm:text-2xl" style={{ ...display, color: "var(--color-ink)", fontWeight: 500 }}>
            Keep the destination. Remove the trail. Shorten what remains.
          </p>

          <p className="mt-4 max-w-lg text-sm leading-relaxed" style={{ ...body, color: "var(--color-ink-soft)" }}>
            That is the whole Lynky pipeline in one sentence.
          </p>
        </div>
      </footer>
    </main>
  );
};

export default Blog;