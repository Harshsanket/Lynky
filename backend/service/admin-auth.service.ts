import crypto from "node:crypto";
import type { Request } from "express";
import { env } from "../src/config/env.js";
import { AdminSession, type IAdminSession } from "../models/admin-session.models.js";
import { getCacheStore } from "./redis.client.js";
import {
  validateAdminPasswordFormat,
  verifyPasswordHash,
} from "../src/utils/admin-password.js";

export {
  createPasswordHash,
  validateAdminPasswordFormat,
} from "../src/utils/admin-password.js";

export const ADMIN_SESSION_COOKIE = "sysadmin_session";

/**
 * Opaque admin sessions use a 30-minute sliding idle window capped by an
 * 8-hour absolute lifetime. Mongo stores only the sha256 digest of the random
 * cookie value, and the cookie `maxAge` matches the absolute cap.
 */
export const ADMIN_SESSION_SLIDING_MS = 30 * 60 * 1000;
export const ADMIN_SESSION_ABSOLUTE_MS = 8 * 60 * 60 * 1000;
const LOCK_THRESHOLD = 3;
const LOCK_SECONDS = 15 * 60;

export class AdminAuthError extends Error {
  statusCode: number;
  code: string;

  constructor(
    message: string,
    statusCode = 401,
    code = "invalid_credentials"
  ) {
    super(message);
    this.name = "AdminAuthError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const sha256 = (value: string): string =>
  crypto.createHash("sha256").update(value).digest("hex");

/**
 * Constant-time CSRF comparison. Both inputs are hashed first so the buffers
 * always have the same length, regardless of attacker-supplied token length.
 */
export const csrfTokenMatches = (
  provided: string | undefined,
  expected: string | undefined
): boolean => {
  if (!provided || !expected) {
    return false;
  }

  const providedDigest = crypto
    .createHash("sha256")
    .update(provided)
    .digest();
  const expectedDigest = crypto
    .createHash("sha256")
    .update(expected)
    .digest();

  return crypto.timingSafeEqual(providedDigest, expectedDigest);
};

const hashSessionId = (sessionId: string): string => sha256(sessionId);

export const validateAdminUsername = (username: unknown): boolean =>
  typeof username === "string" && /^[a-z.]{1,15}$/.test(username);

const identityKey = (ip: string, username: string): string =>
  `${sha256(ip)}:${sha256(username)}`;

const failureKey = (ip: string, username: string): string =>
  `auth:fail:${identityKey(ip, username)}`;

const lockKey = (ip: string, username: string): string =>
  `auth:lock:${identityKey(ip, username)}`;

const isLocked = async (ip: string, username: string): Promise<boolean> => {
  try {
    return Boolean(await getCacheStore().get(lockKey(ip, username)));
  } catch {
    return false;
  }
};

const recordFailure = async (
  ip: string,
  username: string
): Promise<void> => {
  try {
    const store = getCacheStore();
    const key = failureKey(ip, username);
    const count = await store.incrBy(key, 1, LOCK_SECONDS);

    if (count >= LOCK_THRESHOLD) {
      await store.set(lockKey(ip, username), "1", LOCK_SECONDS);
    }
  } catch {
    // Local fallback is inside the cache store; a failure here must not grant
    // access, but the password check has already failed.
  }
};

const clearFailures = async (
  ip: string,
  username: string
): Promise<void> => {
  try {
    const store = getCacheStore();
    await store.del(failureKey(ip, username));
    await store.del(lockKey(ip, username));
  } catch {
    // Ignore cache failures.
  }
};

export const ensureAdminConfigured = (): void => {
  if (!env.SYSADMIN_ENABLED) {
    throw new AdminAuthError(
      "Admin access is disabled.",
      503,
      "admin_disabled"
    );
  }

  if (!env.SYSADMIN_USERNAME || !env.SYSADMIN_PASSWORD_HASH) {
    throw new AdminAuthError(
      "Admin access is not configured.",
      503,
      "admin_not_configured"
    );
  }
};

export interface AdminLoginResult {
  sessionId: string;
  csrfToken: string;
  username: string;
  loggedInAt: Date;
  lastSeenAt: Date;
}

/**
 * Verify credentials and create a Mongo session. Every failure returns the same
 * generic error; invalid input formats count as a failed attempt.
 */
export const loginAdmin = async (
  username: unknown,
  password: unknown,
  ip: string
): Promise<AdminLoginResult> => {
  ensureAdminConfigured();

  const usernameText = typeof username === "string" ? username : "";
  const passwordText = typeof password === "string" ? password : "";

  if (await isLocked(ip, usernameText)) {
    throw new AdminAuthError("Invalid credentials.", 401);
  }

  const formatValid =
    validateAdminUsername(usernameText) &&
    validateAdminPasswordFormat(passwordText);

  let passwordValid = false;

  if (formatValid) {
    passwordValid = await verifyPasswordHash(
      passwordText,
      env.SYSADMIN_PASSWORD_HASH as string
    );
  }

  const usernameValid = usernameText === env.SYSADMIN_USERNAME;

  if (!formatValid || !usernameValid || !passwordValid) {
    await recordFailure(ip, usernameText);
    throw new AdminAuthError("Invalid credentials.", 401);
  }

  await clearFailures(ip, usernameText);

  const now = new Date();
  const sessionId = crypto.randomBytes(32).toString("base64url");
  const csrfToken = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Math.min(
      now.getTime() + ADMIN_SESSION_SLIDING_MS,
      now.getTime() + ADMIN_SESSION_ABSOLUTE_MS
    )
  );

  await AdminSession.create({
    _id: hashSessionId(sessionId),
    usernameHash: sha256(usernameText),
    createdAt: now,
    lastSeenAt: now,
    expiresAt,
    csrfToken,
  });

  return {
    sessionId,
    csrfToken,
    username: usernameText,
    loggedInAt: now,
    lastSeenAt: now,
  };
};

const parseCookies = (header: string | undefined): Record<string, string> => {
  if (!header) {
    return {};
  }

  const result: Record<string, string> = {};

  for (const part of header.split(";")) {
    const index = part.indexOf("=");

    if (index < 0) {
      continue;
    }

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    if (key) {
      try {
        result[key] = decodeURIComponent(value);
      } catch {
        result[key] = value;
      }
    }
  }

  return result;
};

export const readAdminSessionCookie = (req: Request): string | null =>
  parseCookies(req.headers.cookie)[ADMIN_SESSION_COOKIE] ?? null;

export const getAdminSession = async (
  sessionId: string
): Promise<IAdminSession | null> => {
  const now = new Date();
  const session = await AdminSession.findById(hashSessionId(sessionId));

  if (!session) {
    return null;
  }

  const absoluteEnd = new Date(
    session.createdAt.getTime() + ADMIN_SESSION_ABSOLUTE_MS
  );

  if (session.expiresAt.getTime() <= now.getTime() || absoluteEnd <= now) {
    await AdminSession.deleteOne({ _id: session._id });
    return null;
  }

  session.lastSeenAt = now;
  session.expiresAt = new Date(
    Math.min(
      now.getTime() + ADMIN_SESSION_SLIDING_MS,
      absoluteEnd.getTime()
    )
  );

  await session.save();

  return session;
};

export const getAdminSessionFromRequest = async (
  req: Request
): Promise<IAdminSession | null> => {
  const sessionId = readAdminSessionCookie(req);

  return sessionId ? getAdminSession(sessionId) : null;
};

export const deleteAdminSession = async (
  sessionId: string
): Promise<void> => {
  await AdminSession.deleteOne({ _id: hashSessionId(sessionId) });
};

type DeploymentEnv = Pick<
  typeof env,
  "isProduction" | "PUBLIC_URL" | "FRONTEND_URL"
>;

/**
 * Cross-site sysadmin usage (split deployments) needs SameSite=None; same-site
 * deployments keep Strict, which is safer against CSRF.
 */
export const sameSiteForDeployment = (
  config: DeploymentEnv = env
): "strict" | "none" => {
  if (!config.isProduction) {
    return "strict";
  }

  try {
    const backendOrigin = new URL(config.PUBLIC_URL).origin;
    const frontendOrigin = config.FRONTEND_URL
      ? new URL(config.FRONTEND_URL).origin
      : backendOrigin;

    return backendOrigin === frontendOrigin ? "strict" : "none";
  } catch {
    return "none";
  }
};

export const sessionCookieOptions = () => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: sameSiteForDeployment(),
  path: "/",
  maxAge: ADMIN_SESSION_ABSOLUTE_MS,
});

export const clearSessionCookieOptions = () => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: sameSiteForDeployment(),
  path: "/",
});
