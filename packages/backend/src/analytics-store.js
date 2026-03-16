const { getSupabaseAdminClient } = require("./db");

async function recordAnalyticsEvent({ userId, name, props }) {
  const eventName = typeof name === "string" ? name.trim() : "";
  if (!eventName) {
    throw new Error("Analytics event name is required.");
  }

  const eventProps =
    props && typeof props === "object" && !Array.isArray(props) ? props : {};

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("analytics_events").insert({
    user_id: userId ?? null,
    event_name: eventName,
    event_props: eventProps,
    created_at: new Date().toISOString()
  });

  if (error) throw new Error(`Unable to record analytics event: ${error.message}`);
}
async function listRecentAnalyticsEvents({ limit = 50, eventName = "", userId = "" } = {}) {
  const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(200, Math.floor(limit))) : 50;
  const normalizedEventName = typeof eventName === "string" ? eventName.trim() : "";
  const normalizedUserId = typeof userId === "string" ? userId.trim() : "";

  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("analytics_events")
    .select("id, user_id, event_name, event_props, created_at")
    .order("created_at", { ascending: false })
    .limit(normalizedLimit);

  if (normalizedEventName) {
    query = query.eq("event_name", normalizedEventName);
  }
  if (normalizedUserId) {
    query = query.eq("user_id", normalizedUserId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Unable to list analytics events: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    name: row.event_name,
    props: row.event_props && typeof row.event_props === "object" && !Array.isArray(row.event_props)
      ? row.event_props
      : {},
    createdAt: row.created_at
  }));
}

module.exports = { listRecentAnalyticsEvents, recordAnalyticsEvent };
