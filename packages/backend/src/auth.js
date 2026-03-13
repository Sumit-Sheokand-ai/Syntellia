const { getSupabaseAdminClient } = require("./db");

/**
 * Validates a Supabase JWT from the Authorization header and attaches
 * the resolved user to req.user. Returns 401 on any failure.
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"] ?? "";

  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.slice(7);

  try {
    const supabase = getSupabaseAdminClient();
    const {
      data: { user },
      error
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

module.exports = { requireAuth };
