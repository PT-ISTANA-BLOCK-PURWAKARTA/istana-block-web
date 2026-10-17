import { AgingReport } from "@/components/erp/report/AgingReport";

export const metadata = { title: "Umur hutang" };

export default function Page({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  return <AgingReport kind="hutang" searchParams={searchParams} />;
}
