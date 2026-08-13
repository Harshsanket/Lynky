import "dotenv/config";
import crypto from "node:crypto";
import { Link } from "../models/link.models.js";

const BASE62 =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

const CODE_LENGTH = 4;
const EXPIRATION_DAYS = 3;
const MAX_CODE_ATTEMPTS = 20;

/**
 * Exact tracking/query parameters.
 */
const TRACKING_PARAMETERS = new Set([
  // Google Analytics / Google Ads
  "gclid",
  "gclsrc",
  "dclid",
  "gbraid",
  "wbraid",
  "gad_source",
  "gad_campaignid",
  "_ga",
  "_gl",

  // Facebook / Meta
  "fbclid",

  // Microsoft / Bing
  "msclkid",

  // Twitter / X
  "twclid",

  // TikTok
  "ttclid",

  // Instagram
  "igshid",

  // LinkedIn
  "li_fat_id",

  // Yahoo
  "yclid",

  // Mailchimp
  "mc_cid",
  "mc_eid",

  // HubSpot
  "_hsenc",
  "_hsmi",
  "hsa_acc",
  "hsa_ad",
  "hsa_cam",
  "hsa_grp",
  "hsa_kw",
  "hsa_mt",
  "hsa_net",
  "hsa_src",
  "hsa_tgt",
  "hsa_ver",

  // Marketo
  "mkt_tok",

  // Adobe
  "s_cid",
  "s_kwcid",

  // Pinterest
  "epik",

  // Reddit
  "rdt_cid",

  // Snapchat
  "sc_cid",

  // Klaviyo
  "_kx",

  // Vero
  "vero_id",
  "vero_conv",

  // Omeda / Olytics
  "oly_anon_id",
  "oly_enc_id",

  // Rakuten / affiliate networks
  "ranmid",
  "raneaid",
  "ransiteid",

  // Impact affiliate tracking
  "irclickid",

  // Awin
  "awc",

  // Zanox
  "zanpid",

  // ShareASale
  "sscid",

  // Yandex
  "_openstat",

  // Chinese advertising / analytics
  "spm",

  // Generic campaign identifiers
  "campaignid",
  "adgroupid",
  "adid",

  // Misc trackers
  "wickedid",
  "wickedsource",
]);

/**
 * Tracking parameter prefixes.
 */
const TRACKING_PREFIXES = [
  "utm_",
  "hsa_",
  "pk_",
  "mtm_",
  "matomo_",
  "vero_",
  "oly_",
];

/**
 * Dynamic tracking parameter patterns.
 */
const TRACKING_PATTERNS = [
  /^utm_/i,

  // Google Analytics linker parameters
  /^_ga(?:_|$)/i,

  // HubSpot CTA tracking
  /^hsctatracking$/i,

  // Adobe campaign identifiers
  /^s_(?:cid|kwcid)$/i,
];

const isTrackingParameter = (key: string): boolean => {
  const normalizedKey = key.toLowerCase();

  if (TRACKING_PARAMETERS.has(normalizedKey)) {
    return true;
  }

  if (
    TRACKING_PREFIXES.some((prefix) =>
      normalizedKey.startsWith(prefix)
    )
  ) {
    return true;
  }

  return TRACKING_PATTERNS.some((pattern) =>
    pattern.test(normalizedKey)
  );
};

const cleanUrl = (inputUrl: string): string => {
  const url = new URL(inputUrl.trim());

  for (const key of [...url.searchParams.keys()]) {
    if (isTrackingParameter(key)) {
      url.searchParams.delete(key);
    }
  }

  /**
   * Normalize standard ports.
   */
  if (
    (url.protocol === "http:" && url.port === "80") ||
    (url.protocol === "https:" && url.port === "443")
  ) {
    url.port = "";
  }

  /**
   * Keep URL fragments because they can be functional.
   *
   * Example:
   * https://example.com/docs#installation
   */

  return url.toString();
};

const hashUrl = (url: string): string => {
  return crypto
    .createHash("sha256")
    .update(url)
    .digest("hex");
};

/**
 * Generate a Base62 short code.
 */
const generateCode = (
  urlHash: string,
  attempt: number
): string => {
  const digest = crypto
    .createHash("sha256")
    .update(`${urlHash}:${attempt}`)
    .digest();

  let number = digest.readUIntBE(0, 6);

  let code = "";

  for (let i = 0; i < CODE_LENGTH; i++) {
    code += BASE62[number % BASE62.length];
    number = Math.floor(number / BASE62.length);
  }

  return code;
};

export const createShortUrl = async (
  inputUrl: string
) => {

  let parsedUrl: URL;

  /**
   * Validate URL.
   */
  try {
    parsedUrl = new URL(inputUrl.trim());
  } catch {
    throw new Error("Invalid URL");
  }

  /**
   * Only allow HTTP and HTTPS URLs.
   */
  if (
    parsedUrl.protocol !== "http:" &&
    parsedUrl.protocol !== "https:"
  ) {
    throw new Error(
      "Only HTTP and HTTPS URLs are allowed"
    );
  }

  /**
   * Remove tracking parameters.
   */
  const cleanedUrl = cleanUrl(inputUrl);

  /**
   * Reuse an existing shortened URL if the same cleaned URL
   * already exists and has not expired.
   */
  const existingUrl = await Link.findOne({
    originalUrl: cleanedUrl,
    expiresAt: {
      $gt: new Date(),
    },
  }).lean();

  if (existingUrl) {
    const publicUrl = process.env.PUBLIC_URL;

    if (!publicUrl) {
      throw new Error("PUBLIC_URL is not configured");
    }

    const shortUrl = `${publicUrl.replace(
      /\/$/,
      ""
    )}/${existingUrl.code}`;

    return {
      code: existingUrl.code,
      originalUrl: existingUrl.originalUrl,
      shortUrl,
      expiresAt: existingUrl.expiresAt,
    };
  }

  /**
   * Hash the cleaned URL.
   */
  const urlHash = hashUrl(cleanedUrl);

  /**
   * Expire after 3 days.
   */
  const expiresAt = new Date(
    Date.now() +
      EXPIRATION_DAYS * 24 * 60 * 60 * 1000
  );

  /**
   * Generate a unique short code.
   */
  for (
    let attempt = 0;
    attempt < MAX_CODE_ATTEMPTS;
    attempt++
  ) {
    const code = generateCode(urlHash, attempt);

    try {
      const link = await Link.create({
        code,
        originalUrl: cleanedUrl,
        expiresAt,
      });

      const publicUrl = process.env.PUBLIC_URL;
      
      if (!publicUrl) {
        throw new Error("PUBLIC_URL is not configured");
      }

      const shortUrl = `${publicUrl.replace(
        /\/$/,
        ""
      )}/${link.code}`;

      return {
        code: link.code,
        originalUrl: link.originalUrl,
        shortUrl,
        expiresAt: link.expiresAt,
      };
    } catch (error: any) {
      /**
       * MongoDB duplicate-key error.
       *
       * Another URL already owns this code,
       * so generate another code.
       */
      if (error?.code === 11000) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    "Unable to generate a unique short code"
  );
};