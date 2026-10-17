import Link from "next/link";
import { inArray } from "drizzle-orm";
import { PrintButton } from "@/components/erp/PrintButton";
import { BackLink, Kpis, PageHead } from "@/components/erp/ui";
import { schema } from "@/db";
import { asOfPresets } from "@/lib/erp/periods";
import { reportContext } from "@/lib/erp/reportctx";
import { aging } from "@/lib/erp/reports";
import { formatAmount, isDate, tgl, tglPanjang, today } from "@/lib/erp/util";
import { waLink } from "@/lib/format";
import { BarList } from "./BarList";
import { PeriodBar } from "./PeriodBar";
import { ReadingNote, ReportSheet } from "./ReportSheet";

const BUCKETS = ["Belum jatuh tempo", "Lewat 1–30 hari", "Lewat 31–60 hari", "Lewat 61–90 hari", "Lewat > 90 hari"];
// Netral untuk yang belum jatuh tempo, lalu oranye makin pekat makin lama tertunggak.
const BUCKET_COLOR = ["#8a94a8", "#f2a77c", "#e57f45", "#c95a22", "#9c3d12"];

/** Umur piutang (pelanggan) atau umur hutang (pemasok). */
export async function AgingReport({ kind, searchParams }: { kind: "piutang" | "hutang"; searchParams: Promise<{ to?: string }> }) {
  const { me, db, site, npwp } = await reportContext();
  const sp = await searchParams;
  const to = isDate(sp.to) ? sp.to : today();
  const ag = await aging(db, kind, to);
  const overdue = ag.grand - ag.totals[0];
  const old = ag.totals[3] + ag.totals[4];
  const ids = ag.contacts.map((c) => c.id);
  const phones = new Map(ids.length ? (await db.select({ id: schema.contacts.id, phone: schema.contacts.phone }).from(schema.contacts).where(inArray(schema.contacts.id, ids))).map((r) => [r.id, r.phone]) : []);
  const contacts = [...ag.contacts].sort((a, b) => b.buckets.slice(1).reduce((x, y) => x + y, 0) - a.buckets.slice(1).reduce((x, y) => x + y, 0) || b.total - a.total);
  const isAR = kind === "piutang";
  const who = isAR ? "Pelanggan" : "Pemasok";
  const docHref = (id: string) => (isAR ? `/akuntansi/penjualan/${id}` : `/akuntansi/pembelian/${id}`);
  const company = site.legal_name || site.company_name;

  const reminder = (c: (typeof contacts)[number]) => {
    const phone = phones.get(c.id);
    if (!isAR || !phone) return null;
    const lines = c.docs.filter((d) => d.overdue > 0).map((d) => `• ${d.number}: Rp${formatAmount(d.open)} (jatuh tempo ${tgl(d.dueDate)})`);
    if (!lines.length) return null;
    const text = `Yth. ${c.name},\n\nKami dari ${company} ingin mengingatkan tagihan yang sudah jatuh tempo:\n${lines.join("\n")}\n\nMohon konfirmasi rencana pembayarannya. Abaikan pesan ini bila sudah dibayar. Terima kasih.`;
    return waLink(phone, text);
  };

  return (
    <>
      <div className="no-print">
        <BackLink href="/akuntansi/laporan">Laporan</BackLink>
        <PageHead title={isAR ? "Umur piutang" : "Umur hutang"} sub={isAR ? "Siapa yang belum membayar, dan sudah berapa lama lewat jatuh tempo." : "Tagihan pemasok yang belum kita bayar, dan kapan jatuh temponya."}>
          <a className="btn btn-ghost btn-sm" href={`/akuntansi/ekspor/${kind}?to=${to}`}>Unduh CSV (Excel)</a>
          <PrintButton label="Cetak / PDF" />
        </PageHead>
        <PeriodBar path={`/akuntansi/laporan/${kind}`} presets={asOfPresets()} to={to} single />
      </div>
      <ReportSheet site={site} npwp={npwp} title={isAR ? "Laporan Umur Piutang" : "Laporan Umur Hutang"} period={`Per ${tglPanjang(to)}`} printedBy={me.name}>
        <Kpis
          items={[
            { label: isAR ? "Total piutang" : "Total hutang", value: formatAmount(ag.grand), sub: `${ag.docs.length} faktur dari ${ag.contacts.length} ${who.toLowerCase()}` },
            { label: "Belum jatuh tempo", value: formatAmount(ag.totals[0]), sub: ag.grand ? `${Math.round((ag.totals[0] / ag.grand) * 100)}% dari total` : "–", tone: "ok" },
            { label: "Sudah lewat jatuh tempo", value: formatAmount(overdue), sub: ag.grand ? `${Math.round((overdue / ag.grand) * 100)}% dari total` : "–", tone: overdue ? "warn" : undefined },
            { label: "Lewat lebih dari 60 hari", value: formatAmount(old), sub: old ? (isAR ? "perlu ditagih langsung" : "segera dijadwalkan bayar") : "tidak ada", tone: old ? "bad" : undefined },
          ]}
        />
        <section className="report-chart">
          <h3>Berdasarkan lama jatuh tempo</h3>
          <BarList label={`Sebaran ${kind} menurut umur`} rows={BUCKETS.map((b, i) => ({ label: b, value: ag.totals[i], color: BUCKET_COLOR[i] }))} total={ag.grand} max={5} empty={isAR ? "Tidak ada piutang terbuka." : "Tidak ada hutang terbuka."} />
        </section>
        <div className="admin-table report">
          <table>
            <thead>
              <tr><th>{who}</th>{BUCKETS.map((b) => <th key={b} className="num">{b.replace("Lewat ", "")}</th>)}<th className="num">Total</th></tr>
            </thead>
            <tbody>
              {contacts.map((c) => {
                const wa = reminder(c);
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/akuntansi/kontak/${c.id}`}><b>{c.name}</b></Link>
                      <div className="small muted aging-docs">
                        {c.docs.map((d) => (
                          <span key={d.id} className={d.overdue > 0 ? "is-late" : undefined}>
                            <Link href={docHref(d.id)}>{d.number}</Link> {formatAmount(d.open)} · {d.overdue > 0 ? `lewat ${d.overdue} hari` : `jatuh tempo ${tgl(d.dueDate)}`}
                          </span>
                        ))}
                      </div>
                      {wa && <a href={wa} target="_blank" rel="noopener" className="wa-remind no-print">Ingatkan lewat WhatsApp</a>}
                    </td>
                    {c.buckets.map((v, i) => <td key={i} className={`num tabular${i >= 3 && v ? " text-bahaya" : ""}`}>{formatAmount(v, { blankZero: true })}</td>)}
                    <td className="num"><b className="tabular">{formatAmount(c.total)}</b></td>
                  </tr>
                );
              })}
              {contacts.length === 0 && <tr><td colSpan={7} className="muted">{isAR ? "Semua pelanggan sudah lunas." : "Semua tagihan pemasok sudah dibayar."}</td></tr>}
            </tbody>
            <tfoot><tr><th>Total</th>{ag.totals.map((v, i) => <th key={i} className="num">{formatAmount(v)}</th>)}<th className="num">{formatAmount(ag.grand)}</th></tr></tfoot>
          </table>
        </div>
        <ReadingNote>
          Urutan: yang paling lama tertunggak di atas. {isAR ? "Tombol WhatsApp membuat pesan pengingat berisi faktur yang sudah lewat jatuh tempo; periksa dulu sebelum dikirim." : "Pakai laporan ini untuk menjadwalkan pembayaran ke pemasok."}
        </ReadingNote>
      </ReportSheet>
    </>
  );
}
