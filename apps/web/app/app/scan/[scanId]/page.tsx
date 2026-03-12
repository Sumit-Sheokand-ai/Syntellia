import { notFound } from "next/navigation";
import { createServerSupabaseClient, hasSupabaseAuthEnv } from "@/lib/supabase-server";
import { ScanReportClient } from "@/components/report/scan-report-client";
import { getScan } from "@/lib/scan-store";

export const dynamic = "force-dynamic";

export default async function ScanReportPage({ params }: { params: Promise<{ scanId: string }> }) {
  if (!hasSupabaseAuthEnv()) {
    notFound();
  }
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }
  const { scanId } = await params;
  const scan = await getScan(user.id, scanId);

  if (!scan) {
    notFound();
  }

  return (
    <main>
      <ScanReportClient initialScan={scan} />
    </main>
  );
}

