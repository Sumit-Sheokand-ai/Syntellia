const { getSupabasePublicClient } = require("./db");

const DEFAULT_ROLE = "member";
const ROLE_PRECEDENCE = [
  "super_admin",
  "admin",
  "security",
  "ops",
  "billing_admin",
  "member"
];

function normalizeRole(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function collectRoleValues(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeRole).filter(Boolean);
  }
  const normalized = normalizeRole(value);
  return normalized ? [normalized] : [];
}

function resolveUserRoles(user) {
  if (!user || typeof user !== "object") {
    return [DEFAULT_ROLE];
  }

  const appMetadata = user.app_metadata && typeof user.app_metadata === "object" ? user.app_metadata : {};
  const userMetadata = user.user_metadata && typeof user.user_metadata === "object" ? user.user_metadata : {};

  const roleCandidates = [
    ...collectRoleValues(appMetadata.roles),
    ...collectRoleValues(appMetadata.role),
    ...collectRoleValues(userMetadata.roles),
    ...collectRoleValues(userMetadata.role)
  ];
  const deduped = [...new Set(roleCandidates)];

  return deduped.length ? deduped : [DEFAULT_ROLE];
}

function resolvePrimaryRole(roles) {
  if (!Array.isArray(roles) || !roles.length) return DEFAULT_ROLE;
  for (const role of ROLE_PRECEDENCE) {
    if (roles.includes(role)) return role;
  }
  return roles[0];
}

function buildAuthContext(user) {
  const roles = resolveUserRoles(user);
  return {
    userId: user?.id ?? null,
    roles,
    primaryRole: resolvePrimaryRole(roles)
  };
}

function attachAuthContext(req, user) {
  req.authContext = buildAuthContext(user);
}

/**
 * Validates a Supabase JWT from the Authorization header and attaches
 * the resolved user to req.user. Returns 401 on any failure.
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"] ?? "";

  if (!authHeader.startsWith("Bearer ")) {
    req.authContext = null;
    return res.status(401).json({
      error: "Unauthorized",
      code: "UNAUTHORIZED",
      requestId: req.requestId,
      traceId: req.traceId
    });
  }

  const token = authHeader.slice(7);

  try {
    const supabase = getSupabasePublicClient();
    const {
      data: { user },
      error
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      req.authContext = null;
      return res.status(401).json({
        error: "Unauthorized",
        code: "UNAUTHORIZED",
        requestId: req.requestId,
        traceId: req.traceId
      });
    }

    req.user = user;
    req.accessToken = token;
    attachAuthContext(req, user);
    next();
  } catch {
    req.authContext = null;
    return res.status(500).json({
      error: "Authentication service misconfigured.",
      code: "AUTH_SERVICE_MISCONFIGURED",
      requestId: req.requestId,
      traceId: req.traceId
    });
  }
}

async function resolveOptionalAuth(req, _res, next) {
  const authHeader = req.headers["authorization"] ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    req.user = null;
    req.accessToken = null;
    req.authContext = null;
    return next();
  }

  const token = authHeader.slice(7);

  try {
    const supabase = getSupabasePublicClient();
    const {
      data: { user },
      error
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      req.user = null;
      req.accessToken = null;
      req.authContext = null;
      return next();
    }

    req.user = user;
    req.accessToken = token;
    attachAuthContext(req, user);
    return next();
  } catch {
    req.user = null;
    req.accessToken = null;
    req.authContext = null;
    return next();
  }
}

function requireRoles(allowedRoles) {
  const allowed = new Set((allowedRoles ?? []).map(normalizeRole).filter(Boolean));

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Unauthorized",
        code: "UNAUTHORIZED",
        requestId: req.requestId,
        traceId: req.traceId
      });
    }

    if (!allowed.size) {
      return next();
    }

    const actorRoles = req.authContext?.roles ?? [DEFAULT_ROLE];
    const actorRole = req.authContext?.primaryRole ?? DEFAULT_ROLE;
    const hasAccess = actorRoles.some((role) => allowed.has(role));

    if (hasAccess) {
      console.log(
        JSON.stringify({
          level: "info",
          service: "syntellia-backend",
          event: "authz_access_granted",
          actorUserId: req.user.id,
          actorRole,
          actorRoles,
          path: req.originalUrl,
          method: req.method,
          requestId: req.requestId,
          traceId: req.traceId
        })
      );
      return next();
    }

    console.warn(
      JSON.stringify({
        level: "warn",
        service: "syntellia-backend",
        event: "authz_access_denied",
        actorUserId: req.user.id,
        actorRole,
        actorRoles,
        requiredRoles: [...allowed],
        path: req.originalUrl,
        method: req.method,
        requestId: req.requestId,
        traceId: req.traceId
      })
    );

    return res.status(403).json({
      error: "Forbidden",
      code: "INSUFFICIENT_ROLE",
      requiredRoles: [...allowed],
      actorRole,
      requestId: req.requestId,
      traceId: req.traceId
    });
  };
}

module.exports = {
  buildAuthContext,
  normalizeRole,
  requireAuth,
  requireRoles,
  resolveOptionalAuth,
  resolvePrimaryRole,
  resolveUserRoles
};
