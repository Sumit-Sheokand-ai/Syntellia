import { NextResponse } from "next/server";
import { createServerSupabaseClient, hasSupabaseAuthEnv } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedNext = requestUrl.searchParams.get("next");
  const safeNext = requestedNext && requestedNext.startsWith("/") ? requestedNext : "/app/dashboard";

  if (code && hasSupabaseAuthEnv()) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(safeNext, requestUrl.origin));
}
