const { getSupabasePublicClient } = require("./db");

/**
 * Validates a Supabase JWT from the Authorization header and attaches
 * the resolved user to req.user. Returns 401 on any failure.
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"] ?? "";

  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Unauthorized",
      code: "UNAUTHORIZED",
      requestId: req.requestId
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
      return res.status(401).json({
        error: "Unauthorized",
        code: "UNAUTHORIZED",
        requestId: req.requestId
      });
    }

    req.user = user;
    req.accessToken = token;
    next();
  } catch {
    return res.status(500).json({
      error: "Authentication service misconfigured.",
      code: "AUTH_SERVICE_MISCONFIGURED",
      requestId: req.requestId
    });
  }
}

async function resolveOptionalAuth(req, _res, next) {
  const authHeader = req.headers["authorization"] ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    req.user = null;
    req.accessToken = null;
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
      return next();
    }

    req.user = user;
    req.accessToken = token;
    return next();
  } catch {
    req.user = null;
    req.accessToken = null;
    return next();
  }
}

module.exports = { requireAuth, resolveOptionalAuth };
