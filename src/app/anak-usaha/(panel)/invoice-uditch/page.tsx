// Invoice U-Ditch (PT. Istana Block · U-Ditch, IN-UD-…): terpisah dari keuangan IB. Daftar gaya Zahir; pembayaran
// otomatis masuk Operational U-Ditch (M03) sehingga saldo Lina (TF / Cash Lina) bertambah.
import { AnakInvoiceDaftar } from "@/components/erp/AnakInvoiceDaftar";
import { requireAnak } from "@/lib/auth";
import { anakInvoiceRows } from "@/lib/erp/anakInvoices";
import { can } from "@/lib/roles";

export const metadata = { title: "Invoice U-Ditch" };
export const dynamic = "force-dynamic";

export default async function InvoiceUditch({ searchParams }: { searchParams: Promise<{ q?: string; from?: string; to?: string }> }) {
  const user = await requireAnak("uditch", "keuangan");
  const { rows, q, from, to } = await anakInvoiceRows("ud", await searchParams);
  return (
    <AnakInvoiceDaftar
      key={`${q}|${from}|${to}`}
      title="Invoice U-Ditch"
      path="/anak-usaha/invoice-uditch"
      hub="/anak-usaha/menu/uditch"
      infoLabel="Barang"
      rows={rows}
      q={q}
      from={from}
      to={to}
      canEdit={can(user.roles, "keuangan") || can(user.roles, "uditch")}
    />
  );
}
