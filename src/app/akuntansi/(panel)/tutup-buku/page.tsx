// Tutup buku: status kunci transaksi, daftar periode (bulan), riwayat tutup/buka, dan paket audit.
import Link from "next/link";
import { PageHead } from "@/components/erp/ui";
import { AuditPackageButton, ReopenForm } from "@/components/erp/PeriodClose";
import "@/components/erp/periodClose.css";
import { getDb } from "@/db";
import { requireModule } from "@/lib/auth";
import { closeState } from "@/lib/erp/periodClose";
import { periodLockState, periodOf, periodRange, periodsBetween } from "@/lib/erp/periodCloseCore";
import { addDays, tgl, today } from "@/lib/erp/util";
import { can } from "@/lib/roles";

export const metadata = { title: "Tutup Buku & Audit" };
export const dynamic = "force-dynamic";

const at = (sec: number | null) => (sec ? new Date(Number(sec) * 1000).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

export default async function TutupBuku({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const me = await requireModule("keuangan");
  const canClose = can(me.roles, "tutup_buku");
  const { ok } = await searchParams;
  const db = await getDb();
  const st = await closeState(db);
  const current = periodOf(today());
  const periods = periodsBetween(st.first, current > st.next ? current : st.next).reverse();
  const lastByPeriod = new Map<string, (typeof st.records)[number]>();
  for (const r of st.records) if (!lastByPeriod.has(r.period)) lastByPeriod.set(r.period, r);
  const next = periodRange(st.next);
  const running = next.to >= today();
  return (
    <>
      <PageHead title="Tutup Buku & Audit" sub="Analisa per bulan (buku besar, neraca, laba rugi, arus kas, piutang/hutang, stok & bahan baku) sebelum mengunci transaksi, lalu paket audit Excel. Menutup & membuka kembali hanya oleh pemilik dan peran Tutup Buku.">
        <Link href={`/akuntansi/tutup-buku/${st.next}`} className="btn btn-primary btn-sm">{running ? `Analisa ${next.label}` : `Analisa & tutup ${next.label}`}</Link>
      </PageHead>
      {ok && <p className="alert alert-ok" role="status">{ok}</p>}
      <div className="tb-status">
        <div><span className="k">Transaksi terkunci s.d.</span><b>{st.lockDate ? tgl(st.lockDate) : "Belum ada"}</b>{st.latest && <span className="small muted">ditutup {st.latest.closedByName}, {at(st.latest.closedAt)}</span>}</div>
        <div><span className="k">Periode berikutnya untuk ditutup</span><b>{next.label}</b><span className="small muted">{tgl(next.from)} – {tgl(next.to)}{running ? ` · belum selesai, bisa ditutup mulai ${tgl(addDays(next.to, 1))}` : ""}</span></div>
        <div><span className="k">Yang boleh menutup buku</span><b>{canClose ? "Anda (peran Tutup Buku)" : "Pemilik & peran Tutup Buku"}</b><span className="small muted">Atur di Pengguna → peran “Tutup Buku”.</span></div>
      </div>
      {st.legacyLock && (
        <div className="alert alert-warn" style={{ marginBottom: 16 }}>
          Kunci s.d. <b>{tgl(st.lockDate)}</b> diatur lewat Pengaturan lama tanpa catatan tutup buku.
          {canClose && <div style={{ marginTop: 8 }}><ReopenForm id="kunci-lama" label="kunci lama" /></div>}
        </div>
      )}
      <div className="admin-table">
        <table>
          <thead><tr><th>Periode</th><th>Status</th><th>Ditutup</th><th className="num">Masalah</th><th className="num">Perhatian</th><th>Catatan</th><th>Aksi</th></tr></thead>
          <tbody>
            {periods.map((p) => {
              const r = periodRange(p);
              const state = periodLockState(p, st.lockDate);
              const rec = lastByPeriod.get(p);
              const active = rec?.status === "ditutup" ? rec : null;
              return (
                <tr key={p}>
                  <td><Link href={`/akuntansi/tutup-buku/${p}`}><b>{r.label}</b></Link>{p === st.next && <div className="small text-warn">berikutnya</div>}</td>
                  <td><span className={`tb-chip s-${state}`}>{state === "ditutup" ? "Ditutup" : state === "sebagian" ? "Terkunci sebagian" : "Terbuka"}</span>{rec?.status === "dibuka" && <div className="small muted">pernah dibuka kembali</div>}</td>
                  <td className="small">{active ? <>{active.closedByName}<div className="muted">{at(active.closedAt)}</div></> : "—"}</td>
                  <td className="num">{active ? active.issues : "—"}</td>
                  <td className="num">{active ? active.warnings : "—"}</td>
                  <td className="small tb-note">{active?.note || ""}</td>
                  <td className="small">
                    <div className="tb-aksi">
                      <Link href={`/akuntansi/tutup-buku/${p}`}>Analisa</Link>
                      <AuditPackageButton period={p} label={r.label} className="tb-link" text="Paket audit (Excel)" />
                    </div>
                    {canClose && active && st.latest?.id === active.id && <div style={{ marginTop: 6 }}><ReopenForm id={active.id} label={r.label} /></div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {st.records.length > 0 && (
        <section className="admin-table" style={{ marginTop: 20 }}>
          <table className="compact">
            <caption>Riwayat tutup & buka buku</caption>
            <thead><tr><th>Periode</th><th>Ditutup</th><th>Status</th><th>Catatan tutup</th><th>Dibuka kembali</th><th>Alasan buka</th></tr></thead>
            <tbody>
              {st.records.map((r) => (
                <tr key={r.id}>
                  <td>{periodRange(r.period).label}</td>
                  <td className="small">{r.closedByName}<div className="muted">{at(r.closedAt)}</div></td>
                  <td><span className={`tb-chip s-${r.status === "ditutup" ? "ditutup" : "terbuka"}`}>{r.status === "ditutup" ? "Ditutup" : "Dibuka"}</span></td>
                  <td className="small">{r.note || "—"}</td>
                  <td className="small">{r.reopenedByName ? <>{r.reopenedByName}<div className="muted">{at(r.reopenedAt)}</div></> : "—"}</td>
                  <td className="small">{r.reopenReason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
