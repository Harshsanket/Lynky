import crypto from "node:crypto";
import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { PublicError } from "./public-error.service.js";
import {
  ApiKey,
  getUsageMonth,
  MAX_USAGE_HISTORY_MONTHS,
} from "../models/api-key.models.js";

/**
 * API-key lifecycle + usage accounting.
 *
 * Secrets are never stored — only sha256 hashes. Usage rolls over at each
 * month boundary (`usageMonth`), and `incrementApiKeyUsage` is a single
 * atomic update so the 10k/month quota cannot be bypassed under concurrency.
 */

/** Monthly link quota per API key (configurable via env). */
export const MONTHLY_LINK_LIMIT = env.API_KEY_MONTHLY_LIMIT;

export class ApiKeyError extends PublicError {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);

    this.statusCode = statusCode;
  }
}

export const hashApiSecret = (
  secret: string
): string => {
  return crypto
    .createHash("sha256")
    .update(secret)
    .digest("hex");
};

const API_SECRET_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * Generate a random API secret of exactly `env.API_KEY_LENGTH` characters
 * drawn from the base64url alphabet.
 *
 * 256 % 64 === 0, so mapping each random byte modulo 64 is unbiased.
 */
export const generateApiSecret = (): string => {
  const length = env.API_KEY_LENGTH;
  const bytes = crypto.randomBytes(length);

  let secret = "";

  for (let i = 0; i < length; i++) {
    secret += API_SECRET_ALPHABET[bytes[i]! % 64]!;
  }

  return secret;
};

export const provisionApiKeys = async (
  count: number
): Promise<string[]> => {
  const secrets: string[] = [];

  for (let i = 0; i < count; i++) {
    const secret = generateApiSecret();

    const currentMonth = getUsageMonth();

    await ApiKey.create({
      keyHash: hashApiSecret(secret),
      status: "active",
      monthlyUsageCount: 0,
      usageMonth: currentMonth,
      usageHistory: [{ month: currentMonth, count: 0 }],
    });

    secrets.push(secret);
  }

  return secrets;
};

const trimUsageHistory = (
  history: { month: string; count: number }[],
  currentMonth: string
) => {
  const seen = new Set<string>();

  const merged = history.reduceRight<
    { month: string; count: number }[]
  >((acc, entry) => {
    if (seen.has(entry.month)) {
      return acc;
    }

    seen.add(entry.month);

    acc.unshift(entry);

    return acc;
  }, []);

  if (
    merged.length === 0 ||
    merged[merged.length - 1]?.month !== currentMonth
  ) {
    merged.push({ month: currentMonth, count: 0 });
  }

  while (merged.length > MAX_USAGE_HISTORY_MONTHS) {
    merged.shift();
  }

  return merged;
};

export const findAndRolloverApiKey = async (
  secret: string
) => {
  const key = await ApiKey.findOne({
    keyHash: hashApiSecret(secret),
  });

  if (!key) {
    throw new ApiKeyError("Invalid API secret.", 401);
  }

  if (key.status !== "active") {
    throw new ApiKeyError(
      "This API key is disabled. Contact the owner to re-enable it.",
      403
    );
  }

  const currentMonth = getUsageMonth();

  if (key.usageMonth !== currentMonth) {
    await ApiKey.updateOne(
      {
        _id: key._id,
        usageMonth: key.usageMonth,
      },
      {
        $set: {
          usageMonth: currentMonth,
          monthlyUsageCount: 0,
          usageHistory: trimUsageHistory(
            key.usageHistory ?? [],
            currentMonth
          ),
        },
      }
    );

    key.usageMonth = currentMonth;
    key.monthlyUsageCount = 0;
    key.usageHistory = trimUsageHistory(
      key.usageHistory ?? [],
      currentMonth
    );
  }

  return key;
};

export const validateAndPrepareApiKey = async (
  secret: string
) => {
  const key = await findAndRolloverApiKey(secret);

  if (key.monthlyUsageCount >= MONTHLY_LINK_LIMIT) {
    throw new ApiKeyError(
      `Monthly quota of ${MONTHLY_LINK_LIMIT.toLocaleString()} links exceeded. Try again next month.`,
      429
    );
  }

  return key;
};

export const incrementApiKeyUsage = async (
  keyId: mongoose.Types.ObjectId
): Promise<boolean> => {
  const currentMonth = getUsageMonth();

  const result = await ApiKey.updateOne(
    {
      _id: keyId,
      monthlyUsageCount: { $lt: MONTHLY_LINK_LIMIT },
    },
    [
      {
        $set: {
          monthlyUsageCount: {
            $add: [
              { $ifNull: ["$monthlyUsageCount", 0] },
              1,
            ],
          },
          lastUsedAt: new Date(),
          usageHistory: {
            $let: {
              vars: {
                rest: {
                  $filter: {
                    input: {
                      $ifNull: ["$usageHistory", []],
                    },
                    as: "entry",
                    cond: {
                      $ne: ["$$entry.month", currentMonth],
                    },
                  },
                },
                currentCount: {
                  $add: [
                    { $ifNull: ["$monthlyUsageCount", 0] },
                    1,
                  ],
                },
              },
              in: {
                $slice: [
                  {
                    $concatArrays: [
                      "$$rest",
                      [
                        {
                          month: currentMonth,
                          count: "$$currentCount",
                        },
                      ],
                    ],
                  },
                  -MAX_USAGE_HISTORY_MONTHS,
                ],
              },
            },
          },
        },
      },
    ],
    { updatePipeline: true }
  );

  return result.modifiedCount > 0;
};

export const getApiKeyUsage = async (secret: string) => {
  const key = await findAndRolloverApiKey(secret);

  const usageHistory = trimUsageHistory(
    key.usageHistory ?? [],
    key.usageMonth
  );

  const totalUsage12m = usageHistory.reduce(
    (sum, entry) => sum + (entry.count ?? 0),
    0
  );

  return {
    month: key.usageMonth,
    currentUsage: key.monthlyUsageCount,
    monthlyLimit: MONTHLY_LINK_LIMIT,
    totalUsage12m,
  };
};
