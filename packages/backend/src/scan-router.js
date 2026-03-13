const { Router } = require("express");
const { requireAuth, resolveOptionalAuth } = require("./auth");
const {
  createScan,
  createOrGetShareToken,
  getScan,
  getSharedScanByToken,
  listScans
} = require("./scan-store");
const { ValidationError, validateCreateScanPayload } = require("./validation");
const { enforceUserRateLimit } = require("./rate-limit");
const { EntitlementError, consumeScanCredit, getEntitlementSummary } = require("./entitlements");
const { recordAnalyticsEvent } = require("./analytics-store");

const scanRouter = Router();

function sendApiError(res, req, status, code, message) {
  return res.status(status).json({
    error: message,
    code,
    requestId: req.requestId
  });
}

scanRouter.get("/scans", requireAuth, enforceUserRateLimit, async (req, res) => {
  try {
    const scans = await listScans(req.user.id, req.accessToken);
    res.json({ scans });
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

scanRouter.post("/scans/:scanId/share-link", requireAuth, enforceUserRateLimit, async (req, res) => {
  try {
    const shareToken = await createOrGetShareToken(req.user.id, req.accessToken, req.params.scanId);
    if (!shareToken) {
      return sendApiError(res, req, 404, "SCAN_NOT_FOUND", "Scan not found.");
    }

    res.json({
      shareToken,
      sharePath: `/shared/view?token=${encodeURIComponent(shareToken)}`
    });
  } catch (error) {
    sendApiError(res, req, 500, "SHARE_LINK_FAILED", error.message);
  }
});

scanRouter.get("/shared/:shareToken", async (req, res) => {
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

scanRouter.post("/analytics/events", resolveOptionalAuth, async (req, res) => {
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
