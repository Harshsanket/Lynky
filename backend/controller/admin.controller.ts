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
  setMetricErrorCode,
} from "../service/metrics.service.js";
import {
  ApiKeyError,
  deleteApiKey,
  listApiKeys,
  provisionApiKey,
  resetApiKeyUsage,
  setApiKeyStatus,
} from "../service/api-key.service.js";
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

const API_KEY_ID = /^[a-f0-9]{24}$/i;

const parseApiKeyId = (
  value: string | string[] | undefined
): string => {
  const id = Array.isArray(value) ? value[0] : value;

  if (!id || !API_KEY_ID.test(id)) {
    throw new ApiKeyError(
      "Invalid API key id.",
      400,
      "admin_api_key_invalid_id"
    );
  }

  return id;
};

const handleAdminApiKeyError = (
  res: Response,
  error: unknown
): Response => {
  if (error instanceof AdminAuthError) {
    return sendAuthError(res, error);
  }

  if (error instanceof ApiKeyError) {
    if (error.errorCode) {
      res.locals.errorCode = error.errorCode;
    } else if (error.statusCode === 404) {
      res.locals.errorCode = "admin_api_key_not_found";
    }

    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  setMetricErrorCode(
    res,
    "admin_api_key_error",
    "API keys are unavailable."
  );
  logError("admin_api_key_error", error, {
    errorCode: "admin_api_key_error",
  });

  return res.status(503).json({
    success: false,
    message: "API keys are unavailable.",
  });
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

    setMetricErrorCode(res, "admin_login_error", "Unable to sign in.");
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

    setMetricErrorCode(res, "admin_logout_error", "Unable to sign out.");
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
    setMetricErrorCode(
      res,
      "admin_session_error",
      "Admin session is unavailable."
    );
    logError("admin_session_error", error, {
      errorCode: "admin_session_error",
    });

    return res.status(503).json({
      success: false,
      message: "Admin session is unavailable.",
    });
  }
};

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

    setMetricErrorCode(
      res,
      "admin_metrics_error",
      "Metrics are unavailable."
    );
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

    setMetricErrorCode(
      res,
      "admin_benchmark_report_error",
      "Benchmark report is unavailable."
    );
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

    setMetricErrorCode(
      res,
      "admin_errors_error",
      "Errors are unavailable."
    );
    logError("admin_errors_error", error, {
      errorCode: "admin_errors_error",
    });

    return res.status(503).json({
      success: false,
      message: "Errors are unavailable.",
    });
  }
};

export const adminApiKeysController = async (
  req: Request,
  res: Response
) => {
  noStore(res);

  try {
    await requireSession(req);
    const keys = await listApiKeys();

    return res.status(200).json({
      success: true,
      data: { keys },
    });
  } catch (error) {
    return handleAdminApiKeyError(res, error);
  }
};

export const adminCreateApiKeyController = async (
  req: Request,
  res: Response
) => {
  noStore(res);

  try {
    const session = await requireSession(req);

    requireCsrf(session, req);

    const rawLabel = req.body?.label;

    if (typeof rawLabel !== "string") {
      throw new ApiKeyError(
        "A key name is required.",
        400,
        "admin_api_key_invalid_label"
      );
    }

    const label = rawLabel.trim();

    if (!label) {
      throw new ApiKeyError(
        "A key name is required.",
        400,
        "admin_api_key_invalid_label"
      );
    }

    if (label.length > 64) {
      throw new ApiKeyError(
        "Label must be 64 characters or fewer.",
        400,
        "admin_api_key_invalid_label"
      );
    }

    const result = await provisionApiKey({ label });

    return res.status(201).json({
      success: true,
      data: {
        ...result,
        apiBaseUrl: env.PUBLIC_URL.replace(/\/$/, ""),
      },
    });
  } catch (error) {
    return handleAdminApiKeyError(res, error);
  }
};

export const adminResetApiKeyUsageController = async (
  req: Request,
  res: Response
) => {
  noStore(res);

  try {
    const session = await requireSession(req);

    requireCsrf(session, req);

    const key = await resetApiKeyUsage(
      parseApiKeyId(req.params.id)
    );

    if (!key) {
      throw new ApiKeyError(
        "API key not found.",
        404,
        "admin_api_key_not_found"
      );
    }

    return res.status(200).json({
      success: true,
      data: { key },
    });
  } catch (error) {
    return handleAdminApiKeyError(res, error);
  }
};

const setApiKeyStatusController = (
  status: "active" | "disabled"
) => async (req: Request, res: Response) => {
  noStore(res);

  try {
    const session = await requireSession(req);

    requireCsrf(session, req);

    const key = await setApiKeyStatus(
      parseApiKeyId(req.params.id),
      status
    );

    if (!key) {
      throw new ApiKeyError(
        "API key not found.",
        404,
        "admin_api_key_not_found"
      );
    }

    return res.status(200).json({
      success: true,
      data: { key },
    });
  } catch (error) {
    return handleAdminApiKeyError(res, error);
  }
};

export const adminDisableApiKeyController =
  setApiKeyStatusController("disabled");

export const adminEnableApiKeyController =
  setApiKeyStatusController("active");

export const adminDeleteApiKeyController = async (
  req: Request,
  res: Response
) => {
  noStore(res);

  try {
    const session = await requireSession(req);

    requireCsrf(session, req);

    const key = await deleteApiKey(parseApiKeyId(req.params.id));

    if (!key) {
      throw new ApiKeyError(
        "API key not found.",
        404,
        "admin_api_key_not_found"
      );
    }

    return res.status(200).json({
      success: true,
      data: { key },
    });
  } catch (error) {
    return handleAdminApiKeyError(res, error);
  }
};
