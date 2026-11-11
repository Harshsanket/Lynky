import type { Request, Response } from "express";
import { env } from "../src/config/env.js";
import {
  ADMIN_SESSION_COOKIE,
  AdminAuthError,
  clearSessionCookieOptions,
  csrfTokenMatches,
  deleteAdminSession,
  ensureAdminConfigured,
  getAdminSessionFromRequest,
  loginAdmin,
  readAdminSessionCookie,
  sessionCookieOptions,
} from "../service/admin-auth.service.js";
import {
  getDashboardMetrics,
  listErrors,
  markRequestMetric,
} from "../service/metrics.service.js";
import { getLatestTestReport } from "../service/test-report.service.js";
import { logError } from "../service/logger.js";
import type { IAdminSession } from "../models/admin-session.models.js";

const noStore = (res: Response): void => {
  res.setHeader("Cache-Control", "no-store");
};

const clientIp = (req: Request): string =>
  req.ip || req.socket.remoteAddress || "unknown";

const sendAuthError = (res: Response, error: AdminAuthError): Response => {
  if (error.statusCode === 401) {
    markRequestMetric(res, "authFailures");
  }

  return res.status(error.statusCode).json({
    success: false,
    message: error.message,
  });
};

const requireSession = async (req: Request): Promise<IAdminSession> => {
  ensureAdminConfigured();

  const session = await getAdminSessionFromRequest(req);

  if (!session) {
    throw new AdminAuthError("Authentication required.", 401);
  }

  return session;
};

/** Apply to every non-GET admin handler that carries a session cookie. */
const requireCsrf = (
  session: IAdminSession,
  req: Request
): void => {
  if (
    !csrfTokenMatches(
      req.header("x-csrf-token"),
      session.csrfToken
    )
  ) {
    throw new AdminAuthError("Invalid request.", 403, "csrf_failed");
  }
};

export const adminLoginController = async (
  req: Request,
  res: Response
) => {
  noStore(res);

  try {
    const { username, password } = req.body ?? {};
    const result = await loginAdmin(
      username,
      password,
      clientIp(req)
    );

    res.cookie(
      ADMIN_SESSION_COOKIE,
      result.sessionId,
      sessionCookieOptions()
    );

    return res.status(200).json({
      success: true,
      data: {
        authenticated: true,
        username: result.username,
        csrfToken: result.csrfToken,
        loggedInAt: result.loggedInAt.toISOString(),
        lastSeenAt: result.lastSeenAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return sendAuthError(res, error);
    }

    logError("admin_login_error", error, {
      errorCode: "admin_login_error",
    });

    return res.status(500).json({
      success: false,
      message: "Unable to sign in.",
    });
  }
};

export const adminLogoutController = async (
  req: Request,
  res: Response
) => {
  noStore(res);

  try {
    const session = await requireSession(req);

    requireCsrf(session, req);

    const sessionId = readAdminSessionCookie(req);

    if (sessionId) {
      await deleteAdminSession(sessionId);
    }

    res.clearCookie(
      ADMIN_SESSION_COOKIE,
      clearSessionCookieOptions()
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return sendAuthError(res, error);
    }

    logError("admin_logout_error", error, {
      errorCode: "admin_logout_error",
    });

    return res.status(500).json({
      success: false,
      message: "Unable to sign out.",
    });
  }
};

export const adminSessionController = async (
  req: Request,
  res: Response
) => {
  noStore(res);

  if (!envEnabled()) {
    return res.status(200).json({
      success: true,
      data: {
        authenticated: false,
        disabled: true,
      },
    });
  }

  try {
    const session = await getAdminSessionFromRequest(req);

    if (!session) {
      return res.status(200).json({
        success: true,
        data: { authenticated: false },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        authenticated: true,
        csrfToken: session.csrfToken,
        loggedInAt: session.createdAt.toISOString(),
        lastSeenAt: session.lastSeenAt.toISOString(),
      },
    });
  } catch (error) {
    logError("admin_session_error", error, {
      errorCode: "admin_session_error",
    });

    return res.status(503).json({
      success: false,
      message: "Admin session is unavailable.",
    });
  }
};

const envEnabled = (): boolean => env.SYSADMIN_ENABLED;

export const adminMetricsController = async (
  req: Request,
  res: Response
) => {
  noStore(res);

  try {
    await requireSession(req);
    const metrics = await getDashboardMetrics();

    return res.status(200).json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return sendAuthError(res, error);
    }

    logError("admin_metrics_error", error, {
      errorCode: "admin_metrics_error",
    });

    return res.status(503).json({
      success: false,
      message: "Metrics are unavailable.",
    });
  }
};

export const adminBenchmarkReportController = async (
  req: Request,
  res: Response
) => {
  noStore(res);

  /*
   * Benchmark reports are a development-only sysadmin feature. Production
   * answers exactly like an unknown route, without revealing the schema or
   * whether a report exists.
   */
  if (env.isProduction) {
    return res.status(404).json({
      success: false,
      message: "Not found",
    });
  }

  try {
    await requireSession(req);
    const report = await getLatestTestReport();

    return res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return sendAuthError(res, error);
    }

    logError("admin_benchmark_report_error", error, {
      errorCode: "admin_benchmark_report_error",
    });

    return res.status(503).json({
      success: false,
      message: "Benchmark report is unavailable.",
    });
  }
};

export const adminErrorsController = async (
  req: Request,
  res: Response
) => {
  noStore(res);

  try {
    await requireSession(req);
    const limit = Number(req.query.limit ?? 100);
    const errors = await listErrors(
      Number.isInteger(limit) ? limit : 100
    );

    return res.status(200).json({
      success: true,
      data: errors,
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return sendAuthError(res, error);
    }

    logError("admin_errors_error", error, {
      errorCode: "admin_errors_error",
    });

    return res.status(503).json({
      success: false,
      message: "Errors are unavailable.",
    });
  }
};
