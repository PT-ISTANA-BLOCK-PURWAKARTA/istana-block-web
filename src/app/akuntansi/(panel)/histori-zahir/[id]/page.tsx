// Rincian satu dokumen histori Zahir: kepala, baris barang, dan jurnal Zahir yang ditautkan (hanya baca).
import Link from "next/link";
import { sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ZahirPage } from "@/components/erp/ZahirPage";
import { getDb } from "@/db";
import { requireModule } from "@/lib/auth";
import { formatAmount, tgl } from "@/lib/erp/util";
import { isZhKind, ZH_KINDS } from "@/lib/erp/zahirHistory";

export const metadata = { title: "Histori Zahir" };
export const dynamic = "force-dynamic";

type Doc = { id: string; kind: string; ref: string; date: string; party_code: string; party_name: string; note: string; order_ref: string; subtotal: number; journal_number: string; journal_id: string | null; journal_total: number | null };
type Line = { label: string; qty: number; unit: string; price: number; amount: number };

export default async function HistoriZahirDoc({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("keuangan");
  const id = decodeURIComponent((await params).id);
  const db = await getDb();
  const d = await db.get<Doc>(sql`
    select d.*, j.id journal_id, (select sum(l.debit) from fin_journal_lines l where l.journal_id = j.id) journal_total
    from zh_docs d left join fin_journals j on j.source = 'zahir' and j.number = d.journal_number where d.id = ${id} limit 1`);
  if (!d || !isZhKind(d.kind)) notFound();
  const meta = ZH_KINDS[d.kind];
  const lines = await db.all<Line>(sql`select label, qty, unit, price, amount from zh_doc_lines where doc_id = ${id} order by sort`);
  return (
    <ZahirPage title={`${meta.title.replace("Histori ", "")} ${d.ref}`} sub={`${tgl(d.date)} · ${d.party_name}${d.party_code ? ` (${d.party_code})` : ""}${d.note ? ` · ${d.note}` : ""}`} hub={`/akuntansi/histori-zahir?jenis=${d.kind}`}
      actions={d.journal_id ? <Link href={`/akuntansi/jurnal/${d.journal_id}`} className="btn btn-blue btn-sm">Jurnal {d.journal_number}</Link> : undefined}>
      {d.order_ref && <p className="small">Pesanan: <b>{d.order_ref}</b></p>}
      <div className="admin-table">
        <table>
          <thead><tr><th>No</th><th>Barang</th><th className="num">Jumlah</th><th>Satuan</th><th className="num">Harga</th><th className="num">Sub total</th></tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}><td>{i + 1}</td><td>{l.label}</td><td className="num">{Number(l.qty).toLocaleString("id-ID")}</td><td>{l.unit}</td><td className="num">{formatAmount(Math.round(Number(l.price)))}</td><td className="num">{formatAmount(Math.round(Number(l.amount)))}</td></tr>
            ))}
            {!lines.length && <tr><td colSpan={6} className="muted">Laporan Zahir tidak memuat baris barang untuk dokumen ini.</td></tr>}
          </tbody>
          <tfoot><tr><td colSpan={5} className="num"><b>Nilai barang</b></td><td className="num"><b>{formatAmount(Math.round(Number(d.subtotal)))}</b></td></tr></tfoot>
        </table>
      </div>
      <p className="small muted">Hanya baca. Nilai pembukuan dari jurnal Zahir {d.journal_number}{d.journal_total != null ? ` (Rp${formatAmount(Math.round(Number(d.journal_total)))} di sisi debit, termasuk HPP/PPN bila ada)` : " (jurnal tidak ditemukan)"}.</p>
    </ZahirPage>
  );
}
