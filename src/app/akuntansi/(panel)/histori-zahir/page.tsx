// Histori dokumen Zahir (hanya baca): daftar per jenis, cari nomor/pihak/barang, rentang tanggal. Nilai jurnal = jurnal Zahir tautan.
import Link from "next/link";
import { sql } from "drizzle-orm";
import { ZahirPage } from "@/components/erp/ZahirPage";
import { getDb } from "@/db";
import { requireModule } from "@/lib/auth";
import { formatAmount, isDate, tgl } from "@/lib/erp/util";
import { isZhKind, ZH_KINDS, type ZhKind } from "@/lib/erp/zahirHistory";

export const metadata = { title: "Histori Zahir" };
export const dynamic = "force-dynamic";

type Row = { id: string; ref: string; date: string; party_name: string; party_code: string; note: string; subtotal: number; journal_id: string | null; items: string | null };

export default async function HistoriZahir({ searchParams }: { searchParams: Promise<{ jenis?: string; q?: string; from?: string; to?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const kind: ZhKind = isZhKind(sp.jenis) ? sp.jenis : "penjualan";
  const meta = ZH_KINDS[kind];
  const from = isDate(sp.from) ? sp.from : "";
  const to = isDate(sp.to) ? sp.to : "";
  const term = `%${(sp.q ?? "").trim()}%`;
  const db = await getDb();
  const rows = await db.all<Row>(sql`
    select d.id, d.ref, d.date, d.party_name, d.party_code, d.note, d.subtotal,
      (select j.id from fin_journals j where j.source = 'zahir' and j.number = d.journal_number limit 1) journal_id,
      (select group_concat(l.label || ' ' || l.qty || ' ' || l.unit, ' · ') from zh_doc_lines l where l.doc_id = d.id) items
    from zh_docs d
    where d.kind = ${kind} and (${from} = '' or d.date >= ${from}) and (${to} = '' or d.date <= ${to})
      and (d.ref like ${term} or d.party_name like ${term} or d.party_code like ${term} or d.note like ${term}
           or exists (select 1 from zh_doc_lines l where l.doc_id = d.id and l.label like ${term}))
    order by d.date desc, d.ref desc limit 1000`);
  const total = rows.reduce((s, r) => s + Number(r.subtotal), 0);
  return (
    <ZahirPage
      title={meta.title}
      sub="Dokumen Zahir Jun–Okt 2026 (laporan Rincian 28/11/2026), hanya baca. Nilai pembukuannya tetap dari jurnal Zahir yang ditautkan; tidak ada jurnal baru."
      hub={meta.hub}
      actions={(Object.keys(ZH_KINDS) as ZhKind[]).map((k) => (
        <Link key={k} href={`/akuntansi/histori-zahir?jenis=${k}`} className={`btn btn-sm ${k === kind ? "btn-blue" : "btn-ghost"}`}>{k[0].toUpperCase() + k.slice(1)}</Link>
      ))}
    >
      <form method="get" className="filter-bar">
        <input type="hidden" name="jenis" value={kind} />
        <input name="q" defaultValue={sp.q} placeholder={`Cari nomor, ${meta.party.toLowerCase()}, barang`} aria-label="Cari" />
        <input type="date" name="from" defaultValue={from} aria-label="Dari" />
        <input type="date" name="to" defaultValue={to} aria-label="Sampai" />
        <button className="btn btn-blue btn-sm" type="submit">Tampilkan</button>
        <span className="muted small">{rows.length.toLocaleString("id-ID")} dokumen · Rp{formatAmount(Math.round(total))}</span>
      </form>
      <div className="admin-table">
        <table>
          <thead><tr><th>Tanggal</th><th>No. Ref</th><th>{meta.party}</th><th>Barang</th><th className="num">Nilai barang</th><th>Jurnal</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="nowrap">{tgl(r.date)}</td>
                <td><Link href={`/akuntansi/histori-zahir/${encodeURIComponent(r.id)}`}><b>{r.ref}</b></Link></td>
                <td>{r.party_name}{r.party_code && <div className="small muted">{r.party_code}</div>}</td>
                <td className="small">{r.items ?? <span className="muted">{r.note}</span>}</td>
                <td className="num tabular">{Number(r.subtotal) ? formatAmount(Math.round(Number(r.subtotal))) : "-"}</td>
                <td>{r.journal_id ? <Link href={`/akuntansi/jurnal/${r.journal_id}`}>Buka</Link> : <span className="muted">-</span>}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="muted">Tidak ada dokumen.</td></tr>}
          </tbody>
        </table>
      </div>
    </ZahirPage>
  );
}
