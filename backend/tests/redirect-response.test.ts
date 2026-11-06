import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:1/lynky-test";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.PUBLIC_URL = "https://lynky.test";
process.env.FRONTEND_URL = "https://frontend.test";
process.env.EXPIRATION_DAYS = "30";

const {
  sendShortLinkGone,
  sendShortLinkNotFound,
  sendSuccessfulRedirect,
} = await import("../service/redirect-response.service.js");

const makeRes = () => {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    location: undefined as string | undefined,
    setHeader(key: string, value: string) {
      this.headers[key.toLowerCase()] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    redirect(code: number, url: string) {
      this.statusCode = code;
      this.location = url;
      return this;
    },
  };

  return res;
};

const browser = { headers: { accept: "text/html" } } as any;
const api = { headers: { accept: "application/json" } } as any;

test("browsers get a cacheable 302 to the frontend NotFound page", () => {
  const res = makeRes();

  sendShortLinkNotFound(browser, res as any);

  assert.equal(res.statusCode, 302);
  assert.equal(res.location, "https://frontend.test/not-found");
  assert.match(res.headers["cache-control"] ?? "", /max-age=30/);
  assert.match(
    res.headers["vercel-cdn-cache-control"] ?? "",
    /s-maxage=30/
  );
  assert.equal(res.headers.vary, "Accept");
  assert.equal(res.headers["set-cookie"], undefined);
});

test("API clients keep the JSON 404", () => {
  const res = makeRes();

  sendShortLinkNotFound(api, res as any);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, {
    success: false,
    message: "Short URL not found or expired",
  });
});

test("policy failures are cacheable 410s or frontend redirects", () => {
  const apiRes = makeRes();
  sendShortLinkGone(api, apiRes as any);

  assert.equal(apiRes.statusCode, 410);

  const browserRes = makeRes();
  sendShortLinkGone(browser, browserRes as any);

  assert.equal(browserRes.statusCode, 302);
  assert.equal(browserRes.location, "https://frontend.test/not-found");
});

test("successful redirects are never cached", () => {
  const res = makeRes();

  sendSuccessfulRedirect(res as any, "https://example.com/");

  assert.equal(res.statusCode, 302);
  assert.equal(res.location, "https://example.com/");
  assert.equal(res.headers["cache-control"], "no-store");
  assert.equal(res.headers["vercel-cdn-cache-control"], "no-store");
  assert.equal(res.headers["referrer-policy"], "no-referrer");
});
