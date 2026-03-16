const { Router } = require("express");
const { requireAuth, requireRoles, resolveOptionalAuth } = require("./auth");
const {
  createScan,
  createOrGetShareToken,
  revokeShareToken,
  getScan,
  getSharedScanByToken,
  listScans,
  listSavedHistoryViews,
  saveSavedHistoryView,
  deleteSavedHistoryView
} = require("./scan-store");
const {
  ValidationError,
  validateCreateScanPayload,
  validateSavedHistoryViewPayload
} = require("./validation");
const { enforceUserRateLimit } = require("./rate-limit");
const {
  EntitlementError,
  consumeScanCredit,
  getEntitlementOverview,
  getEntitlementSummary
} = require("./entitlements");
const { listRecentAnalyticsEvents, recordAnalyticsEvent } = require("./analytics-store");

const scanRouter = Router();
const ADMIN_ROLES = ["super_admin", "admin", "ops", "security", "billing_admin"];

function sendApiError(res, req, status, code, message) {
  return res.status(status).json({
    error: message,
    code,
    requestId: req.requestId,
    traceId: req.traceId
  });
}

function resolvePositiveInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function resolveActor(req) {
  return {
    userId: req.authContext?.userId ?? req.user?.id ?? null,
    role: req.authContext?.primaryRole ?? "member",
    roles: req.authContext?.roles ?? ["member"]
  };
}

function logAdminAudit(req, action, metadata = {}) {
  console.log(
    JSON.stringify({
      level: "info",
      service: "syntellia-backend",
      event: "admin_audit_log",
      action,
      actor: resolveActor(req),
      metadata,
      requestId: req.requestId,
      traceId: req.traceId,
      ts: new Date().toISOString()
    })
  );
}

scanRouter.get("/scans", requireAuth, enforceUserRateLimit, async (req, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const pageSize = typeof req.query.pageSize === "string" ? req.query.pageSize : "";
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : "";
    const result = await listScans(req.user.id, req.accessToken, {
      status,
      pageSize,
      cursor
    });
    res.json(result);
  } catch (error) {
    sendApiError(res, req, 500, "LIST_SCANS_FAILED", error.message);
  }
});

scanRouter.post("/scans", requireAuth, enforceUserRateLimit, async (req, res) => {
  let payload;

  try {
    payload = validateCreateScanPayload(req.body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendApiError(res, req, error.status, error.code, error.message);
    }
    return sendApiError(res, req, 400, "INVALID_REQUEST", "Request payload is invalid.");
  }

  try {
    await consumeScanCredit(req.user.id);
  } catch (error) {
    if (error instanceof EntitlementError) {
      return sendApiError(res, req, error.status, error.code, error.message);
    }
    return sendApiError(res, req, 500, "ENTITLEMENT_CHECK_FAILED", error.message);
  }

  try {
    const scan = await createScan(req.user.id, req.accessToken, payload);
    res.status(201).json(scan);
  } catch (error) {
    sendApiError(res, req, 500, "CREATE_SCAN_FAILED", error.message);
  }
});

scanRouter.get("/scans/:scanId", requireAuth, enforceUserRateLimit, async (req, res) => {
  try {
    const scan = await getScan(req.user.id, req.accessToken, req.params.scanId);
    if (!scan) return sendApiError(res, req, 404, "SCAN_NOT_FOUND", "Scan not found.");
    res.json(scan);
  } catch (error) {
    sendApiError(res, req, 500, "GET_SCAN_FAILED", error.message);
  }
});

scanRouter.get("/history-views", requireAuth, enforceUserRateLimit, async (req, res) => {
  try {
    const views = await listSavedHistoryViews(req.user.id, req.accessToken);
    res.json({ views });
  } catch (error) {
    sendApiError(res, req, 500, "LIST_HISTORY_VIEWS_FAILED", error.message);
  }
});

scanRouter.post("/history-views", requireAuth, enforceUserRateLimit, async (req, res) => {
  let payload;

  try {
    payload = validateSavedHistoryViewPayload(req.body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendApiError(res, req, error.status, error.code, error.message);
    }
    return sendApiError(res, req, 400, "INVALID_REQUEST", "Request payload is invalid.");
  }

  try {
    const view = await saveSavedHistoryView(req.user.id, req.accessToken, payload);
    const views = await listSavedHistoryViews(req.user.id, req.accessToken);
    res.json({ view, views });
  } catch (error) {
    sendApiError(res, req, 500, "SAVE_HISTORY_VIEW_FAILED", error.message);
  }
});

scanRouter.delete("/history-views/:viewId", requireAuth, enforceUserRateLimit, async (req, res) => {
  const viewId = typeof req.params.viewId === "string" ? req.params.viewId.trim() : "";
  if (!viewId) {
    return sendApiError(res, req, 400, "INVALID_HISTORY_VIEW_ID", "Saved view ID is invalid.");
  }

  try {
    const deleted = await deleteSavedHistoryView(req.user.id, req.accessToken, viewId);
    if (!deleted) {
      return sendApiError(res, req, 404, "HISTORY_VIEW_NOT_FOUND", "Saved view not found.");
    }

    const views = await listSavedHistoryViews(req.user.id, req.accessToken);
    res.json({ views });
  } catch (error) {
    sendApiError(res, req, 500, "DELETE_HISTORY_VIEW_FAILED", error.message);
  }
});

scanRouter.post("/scans/:scanId/share-link", requireAuth, enforceUserRateLimit, async (req, res) => {
  try {
    const share = await createOrGetShareToken(req.user.id, req.accessToken, req.params.scanId);
    if (!share) {
      return sendApiError(res, req, 404, "SCAN_NOT_FOUND", "Scan not found.");
    }

    res.json({
      shareToken: share.shareToken,
      sharePath: `/shared/view?token=${encodeURIComponent(share.shareToken)}`,
      expiresAt: share.expiresAt
    });
  } catch (error) {
    sendApiError(res, req, 500, "SHARE_LINK_FAILED", error.message);
  }
});

scanRouter.post("/scans/:scanId/share-link/revoke", requireAuth, enforceUserRateLimit, async (req, res) => {
  try {
    const revoked = await revokeShareToken(req.user.id, req.accessToken, req.params.scanId);
    if (!revoked) {
      return sendApiError(res, req, 404, "SCAN_NOT_FOUND", "Scan not found.");
    }

    res.status(204).send();
  } catch (error) {
    sendApiError(res, req, 500, "SHARE_LINK_REVOKE_FAILED", error.message);
  }
});

scanRouter.get("/shared/:shareToken", enforceUserRateLimit, async (req, res) => {
  const shareToken = req.params.shareToken?.trim();
  if (!shareToken || shareToken.length < 8) {
    return sendApiError(res, req, 400, "INVALID_SHARE_TOKEN", "Share token is invalid.");
  }

  try {
    const sharedScan = await getSharedScanByToken(shareToken);
    if (!sharedScan) {
      return sendApiError(res, req, 404, "SHARED_SCAN_NOT_FOUND", "Shared scan not found.");
    }
    res.json({ scan: sharedScan });
  } catch (error) {
    sendApiError(res, req, 500, "GET_SHARED_SCAN_FAILED", error.message);
  }
});

scanRouter.get("/billing/entitlements", requireAuth, enforceUserRateLimit, async (req, res) => {
  try {
    const entitlement = await getEntitlementSummary(req.user.id);
    res.json({ entitlement });
  } catch (error) {
    sendApiError(res, req, 500, "GET_ENTITLEMENT_FAILED", error.message);
  }
});

scanRouter.get(
  "/admin/access-context",
  requireAuth,
  requireRoles(ADMIN_ROLES),
  enforceUserRateLimit,
  async (req, res) => {
    try {
      logAdminAudit(req, "admin.access_context.viewed");
      res.json({
        actor: resolveActor(req),
        allowedAdminRoles: ADMIN_ROLES,
        ts: new Date().toISOString()
      });
    } catch (error) {
      sendApiError(res, req, 500, "ADMIN_ACCESS_CONTEXT_FAILED", error.message);
    }
  }
);

scanRouter.get(
  "/admin/entitlements/overview",
  requireAuth,
  requireRoles(ADMIN_ROLES),
  enforceUserRateLimit,
  async (req, res) => {
    try {
      const limitUsers = resolvePositiveInt(req.query.limitUsers, 2000, 1, 10_000);
      const overview = await getEntitlementOverview({ limitUsers });
      logAdminAudit(req, "admin.entitlements.overview.viewed", { limitUsers });
      res.json({
        overview,
        actor: resolveActor(req),
        ts: new Date().toISOString()
      });
    } catch (error) {
      sendApiError(res, req, 500, "ADMIN_ENTITLEMENT_OVERVIEW_FAILED", error.message);
    }
  }
);

scanRouter.get(
  "/admin/analytics/events",
  requireAuth,
  requireRoles(ADMIN_ROLES),
  enforceUserRateLimit,
  async (req, res) => {
    try {
      const limit = resolvePositiveInt(req.query.limit, 50, 1, 200);
      const eventName = typeof req.query.name === "string" ? req.query.name : "";
      const userId = typeof req.query.userId === "string" ? req.query.userId : "";
      const events = await listRecentAnalyticsEvents({ limit, eventName, userId });

      logAdminAudit(req, "admin.analytics.events.viewed", {
        limit,
        eventName: eventName || undefined,
        userId: userId || undefined
      });

      res.json({
        events,
        actor: resolveActor(req),
        filters: {
          limit,
          eventName: eventName || null,
          userId: userId || null
        },
        ts: new Date().toISOString()
      });
    } catch (error) {
      sendApiError(res, req, 500, "ADMIN_ANALYTICS_EVENTS_FAILED", error.message);
    }
  }
);

scanRouter.post("/analytics/events", resolveOptionalAuth, enforceUserRateLimit, async (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const name = typeof body.name === "string" ? body.name : "";
  const props = body.props && typeof body.props === "object" && !Array.isArray(body.props)
    ? body.props
    : {};

  if (!name) {
    return sendApiError(res, req, 400, "INVALID_ANALYTICS_EVENT", "Analytics event name is required.");
  }

  try {
    await recordAnalyticsEvent({
      userId: req.user?.id ?? null,
      name,
      props
    });

    res.status(201).json({ ok: true });
  } catch (error) {
    sendApiError(res, req, 500, "ANALYTICS_EVENT_FAILED", error.message);
  }
});

module.exports = { scanRouter };
