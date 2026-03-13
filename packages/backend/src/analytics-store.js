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

module.exports = { recordAnalyticsEvent };
