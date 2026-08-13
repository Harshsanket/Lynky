import "dotenv/config";
import crypto from "node:crypto";
import { Link } from "../models/link.models.js";

const BASE62 =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

const CODE_LENGTH = 4;
const EXPIRATION_DAYS = 3;
const MAX_CODE_ATTEMPTS = 20;

/* -------------------------------------------------------------------------- */
/*                              Tracking Params                               */
/* -------------------------------------------------------------------------- */

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

  // Rakuten
  "ranmid",
  "raneaid",
  "ransiteid",

  // Impact
  "irclickid",

  // Awin
  "awc",

  // Zanox
  "zanpid",

  // ShareASale
  "sscid",

  // Yandex
  "_openstat",

  // Other advertising / analytics
  "spm",
  "campaignid",
  "adgroupid",
  "adid",
  "wickedid",
  "wickedsource",
]);

const TRACKING_PREFIXES = [
  "utm_",
  "hsa_",
  "pk_",
  "mtm_",
  "matomo_",
  "vero_",
  "oly_",
];

const TRACKING_PATTERNS = [
  /^utm_/i,

  // Google Analytics linker params
  /^_ga(?:_|$)/i,

  // HubSpot CTA
  /^hsctatracking$/i,

  // Adobe
  /^s_(?:cid|kwcid)$/i,
];

/* -------------------------------------------------------------------------- */
/*                                Error Logger                                */
/* -------------------------------------------------------------------------- */

const logError = (
  label: string,
  error: any,
  context?: Record<string, unknown>
) => {
  const timestamp = new Date().toISOString();

  console.error("\n");
  console.error("============================================================");
  console.error(`❌ ${label}`);
  console.error("============================================================");

  console.error(`Timestamp : ${timestamp}`);

  if (context) {
    console.error("\nContext:");
    console.error(
      JSON.stringify(context, null, 2)
    );
  }

  console.error("\nError Details:");

  console.error({
    name: error?.name,
    message: error?.message,
    code: error?.code,
    codeName: error?.codeName,
    errno: error?.errno,
    syscall: error?.syscall,
    hostname: error?.hostname,
    reason: error?.reason,
    cause: error?.cause,
  });

  if (error?.stack) {
    console.error("\nStack Trace:");
    console.error(error.stack);
  }

  console.error(
    "============================================================"
  );
  console.error("\n");
};

/* -------------------------------------------------------------------------- */
/*                           Tracking Param Check                             */
/* -------------------------------------------------------------------------- */

const isTrackingParameter = (
  key: string
): boolean => {
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

/* -------------------------------------------------------------------------- */
/*                                URL Cleaner                                 */
/* -------------------------------------------------------------------------- */

const cleanUrl = (
  inputUrl: string
): string => {
  const url = new URL(inputUrl.trim());

  for (const key of [...url.searchParams.keys()]) {
    if (isTrackingParameter(key)) {
      url.searchParams.delete(key);
    }
  }

  // Normalize standard ports
  if (
    (url.protocol === "http:" && url.port === "80") ||
    (url.protocol === "https:" && url.port === "443")
  ) {
    url.port = "";
  }

  // Keep fragments because they may be functional:
  // https://example.com/docs#installation

  return url.toString();
};

/* -------------------------------------------------------------------------- */
/*                                  Hashing                                   */
/* -------------------------------------------------------------------------- */

const hashUrl = (
  url: string
): string => {
  return crypto
    .createHash("sha256")
    .update(url)
    .digest("hex");
};

/* -------------------------------------------------------------------------- */
/*                           Short Code Generator                             */
/* -------------------------------------------------------------------------- */

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

    number = Math.floor(
      number / BASE62.length
    );
  }

  return code;
};

/* -------------------------------------------------------------------------- */
/*                          Public URL Generator                              */
/* -------------------------------------------------------------------------- */

const getPublicUrl = (
  code: string
): string => {
  const publicUrl = process.env.PUBLIC_URL;

  if (!publicUrl) {
    throw new Error(
      "PUBLIC_URL is not configured"
    );
  }

  return `${publicUrl.replace(/\/$/, "")}/${code}`;
};

/* -------------------------------------------------------------------------- */
/*                            Create Short URL                                */
/* -------------------------------------------------------------------------- */

export const createShortUrl = async (
  inputUrl: string
) => {
  try {
    /* ---------------------------------------------------------------------- */
    /* Validate input                                                        */
    /* ---------------------------------------------------------------------- */

    if (
      !inputUrl ||
      typeof inputUrl !== "string" ||
      !inputUrl.trim()
    ) {
      throw new Error("URL is required");
    }

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(inputUrl.trim());
    } catch (error) {
      logError(
        "URL PARSING ERROR",
        error,
        {
          inputUrl,
        }
      );

      throw new Error("Invalid URL");
    }

    if (
      parsedUrl.protocol !== "http:" &&
      parsedUrl.protocol !== "https:"
    ) {
      throw new Error(
        "Only HTTP and HTTPS URLs are allowed"
      );
    }

    /* ---------------------------------------------------------------------- */
    /* Clean URL                                                              */
    /* ---------------------------------------------------------------------- */

    const cleanedUrl = cleanUrl(inputUrl);

    /* ---------------------------------------------------------------------- */
    /* Check existing URL                                                     */
    /* ---------------------------------------------------------------------- */

    let existingUrl;

    try {
      existingUrl = await Link.findOne({
        originalUrl: cleanedUrl,

        expiresAt: {
          $gt: new Date(),
        },
      }).lean();
    } catch (error: any) {
      logError(
        "DATABASE QUERY ERROR",
        error,
        {
          operation: "findExistingShortUrl",
          model: "Link",
          cleanedUrl,
        }
      );

      // Preserve the original Mongo/Mongoose error
      throw error;
    }

    /* ---------------------------------------------------------------------- */
    /* Return existing URL                                                    */
    /* ---------------------------------------------------------------------- */

    if (existingUrl) {
      let shortUrl: string;

      try {
        shortUrl = getPublicUrl(
          existingUrl.code
        );
      } catch (error) {
        logError(
          "PUBLIC URL CONFIGURATION ERROR",
          error,
          {
            code: existingUrl.code,
          }
        );

        throw error;
      }

      return {
        code: existingUrl.code,
        originalUrl:
          existingUrl.originalUrl,
        shortUrl,
        expiresAt:
          existingUrl.expiresAt,
      };
    }

    /* ---------------------------------------------------------------------- */
    /* Hash cleaned URL                                                       */
    /* ---------------------------------------------------------------------- */

    const urlHash = hashUrl(cleanedUrl);

    /* ---------------------------------------------------------------------- */
    /* Calculate expiration                                                   */
    /* ---------------------------------------------------------------------- */

    const expiresAt = new Date(
      Date.now() +
        EXPIRATION_DAYS *
          24 *
          60 *
          60 *
          1000
    );

    /* ---------------------------------------------------------------------- */
    /* Generate short code                                                    */
    /* ---------------------------------------------------------------------- */

    for (
      let attempt = 0;
      attempt < MAX_CODE_ATTEMPTS;
      attempt++
    ) {
      const code = generateCode(
        urlHash,
        attempt
      );

      try {
        const link = await Link.create({
          code,
          originalUrl: cleanedUrl,
          expiresAt,
        });

        const shortUrl = getPublicUrl(
          link.code
        );

        return {
          code: link.code,
          originalUrl:
            link.originalUrl,
          shortUrl,
          expiresAt: link.expiresAt,
        };
      } catch (error: any) {
        /* ------------------------------------------------------------------ */
        /* Duplicate short-code collision                                     */
        /* ------------------------------------------------------------------ */

        if (error?.code === 11000) {
          console.warn(
            "\n============================================================"
          );

          console.warn(
            "⚠️ SHORT CODE COLLISION"
          );

          console.warn(
            "============================================================"
          );

          console.warn({
            timestamp:
              new Date().toISOString(),
            code,
            attempt,
            cleanedUrl,
          });

          console.warn(
            "Generating another code..."
          );

          console.warn(
            "============================================================\n"
          );

          continue;
        }

        /* ------------------------------------------------------------------ */
        /* Other database errors                                              */
        /* ------------------------------------------------------------------ */

        logError(
          "DATABASE CREATE ERROR",
          error,
          {
            operation:
              "createShortUrl",
            model: "Link",
            code,
            attempt,
            cleanedUrl,
            expiresAt:
              expiresAt.toISOString(),
          }
        );

        throw error;
      }
    }

    throw new Error(
      `Unable to generate a unique short code after ${MAX_CODE_ATTEMPTS} attempts`
    );
  } catch (error: any) {
    /* ---------------------------------------------------------------------- */
    /* Final catch                                                            */
    /* ---------------------------------------------------------------------- */

    logError(
      "CREATE SHORT URL FAILED",
      error,
      {
        inputUrl,
      }
    );

    // Keep exact original error for your controller/error middleware
    throw error;
  }
};