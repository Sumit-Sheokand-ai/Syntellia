import { NextResponse } from "next/server";
import { advanceScan } from "@/lib/scan-store";

export async function GET(_: Request, context: { params: Promise<{ scanId: string }> }) {
  const { scanId } = await context.params;
  const scan = await advanceScan(scanId);

  if (!scan) {
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }

  return NextResponse.json(scan);
}

