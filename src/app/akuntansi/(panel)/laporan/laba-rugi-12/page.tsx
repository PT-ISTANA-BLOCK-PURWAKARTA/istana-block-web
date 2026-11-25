import { ZahirReportPage } from "@/components/erp/report/ZahirReportPage";

export const metadata = { title: "Laba Rugi - 12 Bulan" };

export default async function LabaRugi12({ searchParams }: { searchParams: Promise<{ mulai?: string }> }) {
  const { mulai } = await searchParams;
  return <ZahirReportPage kind="laba-rugi" mulai={mulai} />;
}
