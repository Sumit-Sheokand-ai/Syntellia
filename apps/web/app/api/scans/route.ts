import { NextResponse } from "next/server";
import { createScan, listScans } from "@/lib/scan-store";

export async function GET() {
  const scans = await listScans();
  return NextResponse.json({ scans });
}

export async function POST(request: Request) {
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

  const scan = await createScan({
    url: body.url,
    scanSize: body.scanSize ?? "Standard review",
    loginMode: body.loginMode ?? "No login needed",
    focusArea: body.focusArea ?? "Overall feel"
  });

  return NextResponse.json(scan, { status: 201 });
}
