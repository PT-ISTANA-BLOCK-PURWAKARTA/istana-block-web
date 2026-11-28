// Invoice angkutan Ekspedisi Istana Block (PIC Kendaraan / Cepi): daftar gaya Zahir (cari, filter tanggal, total), buat baru.
import { AnakInvoiceDaftar } from "@/components/erp/AnakInvoiceDaftar";
import { requireAnak } from "@/lib/auth";
import { anakInvoiceRows } from "@/lib/erp/anakInvoices";
import { can } from "@/lib/roles";

export const metadata = { title: "Invoice Angkutan" };
export const dynamic = "force-dynamic";

export default async function InvoiceAngkutan({ searchParams }: { searchParams: Promise<{ q?: string; from?: string; to?: string }> }) {
  const user = await requireAnak("ekspedisi", "keuangan");
  const { rows, q, from, to } = await anakInvoiceRows("eib", await searchParams);
  return (
    <AnakInvoiceDaftar
      key={`${q}|${from}|${to}`}
      title="Invoice Angkutan"
      path="/anak-usaha/invoice-angkutan"
      hub="/anak-usaha/menu/ekspedisi"
      infoLabel="Rute / mobil"
      rows={rows}
      q={q}
      from={from}
      to={to}
      canEdit={can(user.roles, "keuangan") || can(user.roles, "ekspedisi")}
    />
  );
}
