# Lynky

**A shorter, quieter link.**

Lynky is an open-source URL cleaner and shortener designed to make
shared links simpler, cleaner, and less intrusive.

It removes known tracking parameters and unnecessary URL baggage before
generating a compact link that is easier to share.

## 01 / Why Lynky Exists

The internet does not operate under one universal standard of privacy,
consent, or data protection.

Privacy laws differ between countries and regions. Their enforcement
differs as well, and not every website, advertising platform,
application, or online service follows the same practices. Some data
collection serves legitimate purposes such as analytics, security,
diagnostics, fraud prevention, or attribution. Other collection can be
used for persistent tracking, profiling, behavioral analysis,
advertising, fingerprinting, and similar forms of user observation.

A surprising amount of information can also travel through the links
people share. URLs may contain campaign identifiers, referral
information, advertising IDs, analytics parameters, tracking tokens, and
other metadata that is not necessary to reach the content itself.

Sharing something on the internet often means sharing its link. That
link should not need to carry unnecessary baggage with it.

That is why Lynky was built.

> **The link should just be a link.**

Lynky cleans a URL before it is shared, removes known tracking and
unnecessary parameters where they can be safely identified, and produces
a short link containing only what is necessary to redirect to the
cleaned destination.

The result is a link that is easier to read, easier to share, and less
likely to expose unnecessary tracking information.

Short links also avoid filling conversations with excessively long URLs
and can reduce unwanted automatic link previews in applications that
would otherwise immediately request the original destination while
generating a preview.

Both the frontend and backend source code are publicly available for
inspection so that Lynky's behavior can be reviewed rather than simply
trusted.

## 02 / What Lynky Does

-   Removes known tracking parameters from supported URLs.
-   Strips unnecessary URL parameters where they can be safely
    identified.
-   Preserves parameters and URL fragments that may be required for the
    destination to function correctly.
-   Produces short, simple, shareable links.
-   Automatically expires shortened links after their configured
    lifetime.
-   Does not intentionally append its own advertising or tracking
    parameters.
-   Requires no account for normal use.
-   Makes both frontend and backend source code available for
    inspection.
-   Keeps the sharing experience simple and intentionally minimal.

Lynky focuses specifically on information that can be identified and
removed at the URL level.

It **cannot** prevent a destination website or application from
collecting information after you visit it. This includes cookies,
browser or device fingerprinting, IP-based identification, server-side
analytics, authenticated account activity, tracking scripts, request
headers, or other tracking mechanisms outside the URL itself.

Lynky should therefore be considered a URL-cleaning and link-sharing
privacy tool, not a complete anonymity or anti-tracking system.

## 03 / Beta

Lynky is currently in **beta**.

Features, APIs, cleaning rules, infrastructure, and behavior may change
as the project develops. Bugs, outages, incorrect cleaning behavior, and
other unexpected issues may occur.

Use the service accordingly, particularly when a URL contains important
functional parameters.

## 04 / Source & Transparency

Lynky's frontend and backend source code are publicly available for
inspection.

Public source availability does not mean unrestricted use. Personal and
non-commercial use is permitted under the project's license, while
commercial use requires a separate paid commercial license.

See [LICENSE.md](./LICENSE.md) for the complete terms.

## 05 / Thanks

-   **Siddhesh Kumar** --- software engineering support and assistance.
-   **Kevin Roebert / ClearURLs** --- for the ClearURLs project and its
    work on identifying and maintaining URL tracking-parameter rules.
-   **Vercel** --- application hosting and deployment infrastructure.
-   **MongoDB** --- database infrastructure.
-   **Claude & DeepSeek** --- AI-assisted development and
    pair-programming during the project.

## 06 / License

Lynky is source-available for personal and non-commercial use.

**Commercial use requires a separate paid commercial license and prior
written authorization.**

See [LICENSE.md](./LICENSE.md) for the complete license, restrictions,
warranty disclaimer, and limitation of liability.

## 07 / Contact

For queries, suggestions, or contributions, feel free to reach out:

**harshsanket.dev@gmail.com**

------------------------------------------------------------------------

### a Harsh Sanket production
