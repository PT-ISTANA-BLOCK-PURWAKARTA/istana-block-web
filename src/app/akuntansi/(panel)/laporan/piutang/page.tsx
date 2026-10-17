import { AgingReport } from "@/components/erp/report/AgingReport";

export const metadata = { title: "Umur piutang" };

export default function Page({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  return <AgingReport kind="piutang" searchParams={searchParams} />;
}
