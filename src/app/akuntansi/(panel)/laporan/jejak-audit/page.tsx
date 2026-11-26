// Jejak Audit - Rangkuman / Rincian (seperti Zahir): siapa mencatat atau mengubah jurnal apa, kapan, berapa nilainya,
// ditambah catatan aktivitas modul keuangan (gaji, kasbon, dll.).
import Link from "next/link";
import { sql } from "drizzle-orm";
import { PrintButton } from "@/components/erp/PrintButton";
import { PeriodBar } from "@/components/erp/report/PeriodBar";
import { ZahirForm, zDate, zn, zPeriod } from "@/components/erp/report/ZahirForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { Select } from "@/components/ui";
import { auditTrail } from "@/lib/erp/journalReports";
import { SOURCE_LABEL, sourceHref } from "@/lib/erp/links";
import { rangePresets } from "@/lib/erp/periods";
import { reportContext } from "@/lib/erp/reportctx";
import { isDate, monthStart, today } from "@/lib/erp/util";

export const metadata = { title: "Jejak Audit" };

const ts = (d: string, endOfDay = false) => Math.floor(Date.parse(`${d}T${endOfDay ? "24:00:00" : "00:00:00"}+07:00`) / 1000);
const when = (t: number) => new Date(t * 1000).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function JejakAudit({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; mode?: string; user?: string }> }) {
  const { db, site } = await reportContext();
  const sp = await searchParams;
  const to = isDate(sp.to) ? sp.to : today();
  const from = isDate(sp.from) && sp.from <= to ? sp.from : monthStart(to);
  const mode = sp.mode === "rincian" ? "rincian" : "rangkuman";
  const users = await db.all<{ id: number; name: string }>(sql`select distinct u.id, u.name from users u join fin_journals j on j.created_by = u.id order by u.name`);
  const userId = users.find((u) => String(u.id) === sp.user)?.id;
  const a = await auditTrail(db, ts(from), ts(to, true), userId);
  const keep = { mode, ...(userId ? { user: String(userId) } : {}) };
  const title = `Jejak Audit - ${mode === "rincian" ? "Rincian" : "Rangkuman"}`;
  return (
    <>
      <div className="no-print">
        <BackLink href="/akuntansi/laporan?k=keuangan&t=1">Laporan</BackLink>
        <PageHead title={title} sub="Dihitung dari waktu jurnal dicatat atau diubah (bukan tanggal transaksi). Jurnal impor Zahir tercatat pada hari impor.">
          <Link href={`/akuntansi/laporan/jejak-audit?${new URLSearchParams({ from, to, mode: mode === "rincian" ? "rangkuman" : "rincian", ...(userId ? { user: String(userId) } : {}) })}`} className="btn btn-ghost btn-sm">{mode === "rincian" ? "Lihat rangkuman" : "Lihat rincian"}</Link>
          <PrintButton label="Cetak / PDF" />
        </PageHead>
        <PeriodBar
          path="/akuntansi/laporan/jejak-audit"
          presets={rangePresets()}
          from={from}
          to={to}
          keep={keep}
          keepInForm={false}
          extra={
            <>
              <input type="hidden" name="mode" value={mode} />
              <label className="grow"><span>Pengguna</span><Select name="user" defaultValue={userId ? String(userId) : ""} options={[{ value: "", label: "Semua pengguna" }, ...users.map((u) => ({ value: String(u.id), label: u.name }))]} /></label>
            </>
          }
        />
      </div>
      <ZahirForm company={site.legal_name || site.company_name || "PT. Istana Block Purwakarta"} title={title} period={zPeriod(from, to)}>
        {mode === "rangkuman" ? (
          <table className="zf-table">
            <thead><tr><th>Pengguna</th><th>Sumber</th><th className="num">Jumlah jurnal</th><th className="num">Diubah</th><th className="num">Nilai</th></tr></thead>
            <tbody>
              {a.summary.map((s, i) => (
                <tr key={i}><td>{s.userName ?? "(sistem)"}</td><td>{SOURCE_LABEL[s.source] ?? s.source}</td><td className="num">{s.n.toLocaleString("id-ID")}</td><td className="num">{s.edited || ""}</td><td className="num">{zn(s.total, true)}</td></tr>
              ))}
              {!a.summary.length && <tr><td colSpan={5}>Tidak ada jurnal dicatat pada periode ini.</td></tr>}
            </tbody>
            <tfoot><tr className="zf-total"><td colSpan={2}>Jumlah</td><td className="num">{a.summary.reduce((x, s) => x + s.n, 0).toLocaleString("id-ID")}</td><td className="num">{a.summary.reduce((x, s) => x + s.edited, 0) || ""}</td><td className="num">{zn(a.summary.reduce((x, s) => x + s.total, 0), true)}</td></tr></tfoot>
          </table>
        ) : (
          <table className="zf-table">
            <colgroup><col style={{ width: 128 }} /><col style={{ width: 120 }} /><col className="zf-c-date" /><col className="zf-c-ref" /><col /><col className="zf-c-num" /></colgroup>
            <thead><tr><th>Dicatat / diubah</th><th>Pengguna</th><th>Tgl. Transaksi</th><th>No. Ref.</th><th>Keterangan</th><th className="num">Nilai</th></tr></thead>
            <tbody>
              {a.rows.map((r) => (
                <tr key={r.id}>
                  <td className="nowrap">{when(r.createdAt)}{r.updatedAt > r.createdAt + 5 && <em className="zf-sub">diubah {when(r.updatedAt)}</em>}</td>
                  <td>{r.userName ?? "(sistem)"}</td>
                  <td className="nowrap">{zDate(r.date)}</td>
                  <td className="nowrap"><Link href={sourceHref(r.source, r.sourceId, r.id)}>{r.number}</Link></td>
                  <td>{r.memo}<em className="zf-sub">{SOURCE_LABEL[r.source] ?? r.source}</em></td>
                  <td className="num">{zn(r.total, true)}</td>
                </tr>
              ))}
              {!a.rows.length && <tr><td colSpan={6}>Tidak ada jurnal dicatat atau diubah pada periode ini.</td></tr>}
            </tbody>
          </table>
        )}
        {a.activity.length > 0 && (
          <section>
            <h3 className="zf-h3">Aktivitas modul keuangan lainnya</h3>
            <table className="zf-table">
              <thead><tr><th style={{ width: 128 }}>Waktu</th><th style={{ width: 120 }}>Pengguna</th><th>Aktivitas</th><th>Ringkasan</th></tr></thead>
              <tbody>{a.activity.map((x, i) => <tr key={i}><td className="nowrap">{when(x.at)}</td><td>{x.userName ?? "-"}</td><td>{x.label}{!x.success && " (gagal)"}</td><td className="small">{x.summary ?? ""}</td></tr>)}</tbody>
            </table>
          </section>
        )}
      </ZahirForm>
    </>
  );
}
