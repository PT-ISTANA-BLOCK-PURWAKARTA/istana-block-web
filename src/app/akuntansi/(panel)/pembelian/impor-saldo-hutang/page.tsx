// Impor saldo awal hutang per faktur dari Zahir.
import { OpeningImportPage } from "@/components/erp/OpeningImportPage";

export const metadata = { title: "Impor Saldo Awal Hutang" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <OpeningImportPage kind="hutang" />;
}
