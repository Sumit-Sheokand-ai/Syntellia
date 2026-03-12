import { notFound } from "next/navigation";
import { ScanReportClient } from "@/components/report/scan-report-client";
import { getScan } from "@/lib/scan-store";

export const dynamic = "force-dynamic";

export default async function ScanReportPage({ params }: { params: Promise<{ scanId: string }> }) {
  const { scanId } = await params;
  const scan = await getScan(scanId);

  if (!scan) {
    notFound();
  }

  return (
    <main>
      <ScanReportClient initialScan={scan} />
    </main>
  );
}

