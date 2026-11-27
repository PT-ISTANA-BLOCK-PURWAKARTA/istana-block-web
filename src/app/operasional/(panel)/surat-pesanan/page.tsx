// Surat pesanan barang ke pemasok — Operasional hanya melihat & mencetak; pembuatan surat dipindah ke Keuangan.
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHead } from "@/components/erp/ui";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import { tglPanjang } from "@/lib/erp/util";
import { canViewPurchaseLetters, listPurchaseLetters } from "@/lib/ops/purchaseLetters";

export const metadata = { title: "Surat pesanan" };

export default async function SuratPesanan({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requirePerm("iso", "pesanan");
  if (!canViewPurchaseLetters(me.roles)) redirect("/operasional");
  const sp = await searchParams;
  const letters = await listPurchaseLetters(await getDb());
  const term = (sp.q ?? "").trim().toLowerCase();
  const shown = (term ? letters.filter((l) => [l.number, l.supplierName, l.contactName ?? "", l.items.map((i) => i.name).join(" ")].join(" ").toLowerCase().includes(term)) : letters).filter((l) => l.status !== "draft");
  return (
    <>
      <PageHead title="Surat pesanan barang" sub="Lihat & cetak saja. Surat pesanan ke pemasok dibuat oleh Keuangan (permintaan tetap lewat F-IB-10 di Rekap ISO)." />
      <form className="filter-bar" method="get">
        <div className="field"><label htmlFor="pl-q">Cari nomor / pemasok / barang</label><input id="pl-q" name="q" defaultValue={sp.q ?? ""} /></div>
        <button type="submit" className="btn btn-blue btn-sm">Cari</button>
      </form>
      {!shown.length ? (
        <div className="admin-card muted">{letters.length ? "Tidak ada surat yang cocok." : "Belum ada surat pesanan."}</div>
      ) : (
        <div className="admin-table">
          <table className="compact">
            <thead><tr><th>Nomor</th><th>Tanggal</th><th>Kepada</th><th>Barang</th><th>Penanda tangan</th><th /></tr></thead>
            <tbody>
              {shown.map((l) => (
                <tr key={l.id}>
                  <td><b>{l.number}</b></td>
                  <td>{tglPanjang(l.letterDate)}</td>
                  <td>{l.supplierName || "-"}{l.contactName && <div className="small muted">U.p. {l.contactName}</div>}</td>
                  <td className="small">{l.items.map((i) => `${i.name}${i.quantity !== null ? ` ${i.quantity.toLocaleString("id-ID")} ${i.unit ?? ""}` : ""}`.trim()).join(", ")}</td>
                  <td className="small">{l.signerName ?? "-"}</td>
                  <td><Link href={`/operasional/cetak/surat-pesanan/${l.id}`} target="_blank" className="btn btn-ghost btn-sm">Cetak</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
