import { NextResponse } from "next/server";
import { advanceScan } from "@/lib/scan-store";
import { createServerSupabaseClient, hasSupabaseAuthEnv } from "@/lib/supabase-server";

export async function GET(_: Request, context: { params: Promise<{ scanId: string }> }) {
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
  const { scanId } = await context.params;
  const scan = await advanceScan(user.id, scanId);

  if (!scan) {
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }

  return NextResponse.json(scan);
}

