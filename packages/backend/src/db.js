const { createClient } = require("@supabase/supabase-js");
let publicClient = null;
let adminClient = null;

function readSupabaseUrl() {
  return process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
}

function readSupabasePublishableKey() {
  return process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";
}
function readSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

function ensurePublicConfig() {
  const url = readSupabaseUrl();
  const publishableKey = readSupabasePublishableKey();

  if (!url || !publishableKey) {
    throw new Error("Missing Supabase API credentials. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.");
  }

  return { url, publishableKey };
}

function getSupabasePublicClient() {
  if (publicClient) return publicClient;

  const { url, publishableKey } = ensurePublicConfig();

  publicClient = createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return publicClient;
}
function getSupabaseAdminClient() {
  if (adminClient) return adminClient;

  const url = readSupabaseUrl();
  const serviceRoleKey = readSupabaseServiceRoleKey();

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase service credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  adminClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return adminClient;
}

function createSupabaseUserClient(accessToken) {
  if (!accessToken) {
    throw new Error("Missing access token for user-scoped Supabase client.");
  }

  const { url, publishableKey } = ensurePublicConfig();

  return createClient(url, publishableKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

module.exports = {
  getSupabaseAdminClient,
  getSupabasePublicClient,
  createSupabaseUserClient
};
