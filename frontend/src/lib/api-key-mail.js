/**
 * Build the one-time API-key sharing mail.
 *
 * The raw secret only exists in the create response, so the mail is composed
 * in the browser and handed to the user's mail client. No key material is
 * stored or sent anywhere by Lynky.
 */

const SUBJECT = "Your Lynky API key";

export const buildApiKeyMailto = ({
  secret,
  apiBaseUrl,
  apiGuideUrl,
  monthlyLimit,
}) => {
  const baseUrl = String(apiBaseUrl ?? "").replace(/\/+$/, "");
  const limit = Number(monthlyLimit);
  const limitLabel = Number.isFinite(limit)
    ? limit.toLocaleString("en-US")
    : String(monthlyLimit ?? "");

  const body = `Welcome to Lynky secret club

Here is your Lynky API key — keep it safe; it
is shown only once.

How to use it:
1. Shorten a link: POST ${baseUrl}/api/v1/api/urls
   Header: Authorization: Bearer <your key>
   Body: {"url": "https://example.com/your-long-link"}
   The response returns the short link.
2. Check usage any time: GET ${baseUrl}/api/v1/api/stats/usage
   Monthly limit: ${limitLabel} links, resetting each month.

Full API guide: ${apiGuideUrl}

Your API key:
${secret}

a Harsh Sanket production`;

  return {
    subject: SUBJECT,
    body,
    href: `mailto:?subject=${encodeURIComponent(
      SUBJECT
    )}&body=${encodeURIComponent(body)}`,
  };
};
