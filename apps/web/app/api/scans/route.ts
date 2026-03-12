import { NextResponse } from "next/server";
import { createScan, listScans } from "@/lib/scan-store";
import { createServerSupabaseClient, hasSupabaseAuthEnv } from "@/lib/supabase-server";

export async function GET() {
  if (!hasSupabaseAuthEnv()) {
    return NextResponse.json({ error: "Server auth is not configured." }, { status: 500 });
  }
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scans = await listScans(user.id);
  return NextResponse.json({ scans });
}

export async function POST(request: Request) {
  if (!hasSupabaseAuthEnv()) {
    return NextResponse.json({ error: "Server auth is not configured." }, { status: 500 });
  }
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json()) as {
    url?: string;
    scanSize?: string;
    loginMode?: string;
    focusArea?: string;
  };

  if (!body.url) {
    return NextResponse.json({ error: "Please add a full page link." }, { status: 400 });
  }

  try {
    new URL(body.url);
  } catch {
    return NextResponse.json({ error: "Please use a full link that starts with http:// or https://." }, { status: 400 });
  }

  const scan = await createScan(user.id, {
    url: body.url,
    scanSize: body.scanSize ?? "Standard review",
    loginMode: body.loginMode ?? "No login needed",
    focusArea: body.focusArea ?? "Overall feel"
  });

  return NextResponse.json(scan, { status: 201 });
}
