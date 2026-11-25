import { ZahirReportPage } from "@/components/erp/report/ZahirReportPage";

export const metadata = { title: "Neraca - 12 Bulan" };

export default async function Neraca12({ searchParams }: { searchParams: Promise<{ mulai?: string }> }) {
  const { mulai } = await searchParams;
  return <ZahirReportPage kind="neraca" mulai={mulai} />;
}
