// Analisa sebelum tutup buku satu periode (bulan) + form tutup buku (khusus peran Tutup Buku) + paket audit.
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink, Kpis, PageHead } from "@/components/erp/ui";
import { AuditPackageButton, ClosePeriodForm, ReopenForm } from "@/components/erp/PeriodClose";
import "@/components/erp/periodClose.css";
import { getDb } from "@/db";
import { requireModule } from "@/lib/auth";
import { analyzePeriod, closeState } from "@/lib/erp/periodClose";
import { AREA_LABEL, AREA_ORDER, isPeriod, periodLockState, periodRange, STATUS_LABEL, type CheckStatus } from "@/lib/erp/periodCloseCore";
import { addDays, formatAmount, tgl, today } from "@/lib/erp/util";
import { can } from "@/lib/roles";

export const metadata = { title: "Analisa tutup buku" };
export const dynamic = "force-dynamic";

const rp = (n: number) => `Rp${formatAmount(n)}`;
const at = (sec: number | null) => (sec ? new Date(Number(sec) * 1000).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
const ORDER: CheckStatus[] = ["masalah", "perhatian", "ok", "info"];

export default async function AnalisaTutupBuku({ params, searchParams }: { params: Promise<{ periode: string }>; searchParams: Promise<{ ok?: string }> }) {
  const me = await requireModule("keuangan");
  const canClose = can(me.roles, "tutup_buku");
  const { periode } = await params;
  if (!isPeriod(periode)) notFound();
  const { ok } = await searchParams;
  const db = await getDb();
  const [st, a] = await Promise.all([closeState(db), analyzePeriod(db, periode)]);
  const { label, from, to } = periodRange(periode);
  const state = periodLockState(periode, st.lockDate);
  const rec = st.records.find((r) => r.period === periode && r.status === "ditutup") ?? null;
  const s = a.summary;
  const tone = (d: number) => (Math.abs(d) >= 1000 ? "warn" : "ok") as "warn" | "ok";
  return (
    <>
      <BackLink href="/akuntansi/tutup-buku">Tutup Buku</BackLink>
      <PageHead title={`Analisa tutup buku — ${label}`} sub={<>{tgl(from)} – {tgl(to)} · <span className={`tb-chip s-${state}`}>{state === "ditutup" ? "Ditutup" : state === "sebagian" ? "Terkunci sebagian" : "Terbuka"}</span></>}>
        <AuditPackageButton period={periode} label={label} />
      </PageHead>
      {ok && <p className="alert alert-ok" role="status">{ok}</p>}
      <Kpis
        items={[
          { label: "Pendapatan", value: rp(s.revenue), sub: `laba bersih ${rp(s.net)}`, href: `/akuntansi/laporan/laba-rugi?dari=${periode}&sampai=${periode}` },
          { label: "Total aset", value: rp(s.assets), sub: s.balanced ? "neraca seimbang" : "NERACA TIDAK SEIMBANG", tone: s.balanced ? "ok" : "bad", href: `/akuntansi/laporan/neraca?to=${to}` },
          { label: "Kas & bank akhir", value: rp(s.cashClosing), sub: `masuk ${rp(s.cashIn)} · keluar ${rp(s.cashOut)}`, href: `/akuntansi/laporan/arus-kas?from=${from}&to=${to}` },
          { label: "Stok barang jadi", value: rp(s.stockFinished), sub: `akun ${rp(s.glFinished)}`, tone: tone(s.glFinished - s.stockFinished) },
          { label: "Bahan baku", value: rp(s.stockRaw), sub: `akun ${rp(s.glRaw)}`, tone: tone(s.glRaw - s.stockRaw) },
          { label: "Piutang (rincian)", value: rp(s.receivable), sub: `akun ${rp(s.glReceivable)}`, tone: tone(s.glReceivable - s.receivable) },
          { label: "Hutang (rincian)", value: rp(s.payable), sub: `akun ${rp(s.glPayable)}`, tone: tone(s.glPayable - s.payable) },
        ]}
      />
      <div className="tb-counts">
        {ORDER.map((k) => <span key={k} className={`tb-chip s-${k}`}>{a.counts[k]} {STATUS_LABEL[k]}</span>)}
        <span className="small muted">Dianalisa {new Date(a.generatedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" })}</span>
      </div>

      {AREA_ORDER.map((area) => {
        const list = a.checks.filter((c) => c.area === area).sort((x, y) => ORDER.indexOf(x.status) - ORDER.indexOf(y.status));
        if (!list.length) return null;
        return (
          <section key={area} className="tb-area">
            <h2>{AREA_LABEL[area]}</h2>
            {list.map((c) => (
              <div key={c.key} className={`tb-check is-${c.status}`}>
                <span><span className={`tb-chip s-${c.status}`}>{STATUS_LABEL[c.status]}</span></span>
                <div className="stack" style={{ gap: 2 }}>
                  <span className="lbl">{c.label}</span>
                  <span className="val">{c.value} {c.href && <Link href={c.href} className="small">Buka →</Link>}</span>
                  {c.hint && <span className="hint">{c.hint}</span>}
                </div>
                {c.table && c.table.rows.length > 0 && (
                  <details>
                    <summary>Lihat rincian ({c.table.rows.length + (c.table.more ?? 0)})</summary>
                    <div className="admin-table">
                      <table className="compact">
                        <thead><tr>{c.table.cols.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                        <tbody>
                          {c.table.rows.map((row, i) => (
                            <tr key={i}>{row.map((v, j) => <td key={j} className={typeof v === "number" ? "num" : undefined}>{typeof v === "number" ? formatAmount(v) : v}</td>)}</tr>
                          ))}
                        </tbody>
                      </table>
                      {c.table.more ? <p className="small muted">… dan {c.table.more} baris lagi (lengkap di paket audit).</p> : null}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </section>
        );
      })}

      <section className="tb-close">
        {state === "ditutup" && rec ? (
          <>
            <h2>Sudah ditutup</h2>
            <p style={{ margin: 0 }}>Ditutup oleh <b>{rec.closedByName}</b> pada {at(rec.closedAt)} dengan {rec.issues} masalah dan {rec.warnings} perhatian.{rec.note ? ` Catatan: ${rec.note}` : ""}</p>
            {canClose && st.latest?.id === rec.id && <div style={{ marginTop: 10 }}><ReopenForm id={rec.id} label={label} /></div>}
          </>
        ) : state === "ditutup" ? (
          <><h2>Terkunci</h2><p style={{ margin: 0 }}>Periode ini terkunci oleh kunci lama s.d. {tgl(st.lockDate)} (tanpa catatan tutup buku).</p></>
        ) : periode !== st.next ? (
          <><h2>Belum bisa ditutup</h2><p style={{ margin: 0 }}>Tutup buku harus berurutan. Tutup dulu <Link href={`/akuntansi/tutup-buku/${st.next}`}>{periodRange(st.next).label}</Link>.</p></>
        ) : to >= today() ? (
          <><h2>Tutup buku {label}</h2><p style={{ margin: 0 }}>Periode ini belum selesai (berakhir {tgl(to)}). Tutup buku bisa dilakukan mulai <b>{tgl(addDays(to, 1))}</b>; analisa di atas bisa dipakai untuk persiapan.</p></>
        ) : !canClose ? (
          <><h2>Tutup buku {label}</h2><p style={{ margin: 0 }}>Hanya pemilik dan pengguna berperan <b>Tutup Buku</b> yang bisa menutup buku. Kirim hasil analisa ini (paket audit) ke mereka.</p></>
        ) : (
          <><h2>Tutup buku {label}</h2><ClosePeriodForm period={periode} label={label} to={to} masalah={a.counts.masalah} perhatian={a.counts.perhatian} /></>
        )}
      </section>
    </>
  );
}
