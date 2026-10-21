import "./muatan.css";
import Link from "next/link";
import { Ok, PageHead } from "@/components/erp/ui";
import { AutoRefresh } from "@/components/ops/delivery/AutoRefresh";
import { LoadButton } from "@/components/ops/delivery/LoadButton";
import { NotificationPanel, type NoticeItem } from "@/components/ops/delivery/NotificationPanel";
import { DeliveryStatusBadge } from "@/components/ops/delivery/StatusBadge";
import { Icon } from "@/components/panel/Icon";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import { navUrl } from "@/lib/erp/driver";
import { formatQty, tgl, today } from "@/lib/erp/util";
import { boardJobs, unreadNotifications, type BoardRange } from "@/lib/ops/deliveries";
import { currentShift } from "@/lib/ops/duty";
import { can, needsShift } from "@/lib/roles";

export const metadata = { title: "Muatan" };
export const dynamic = "force-dynamic";

const RANGES: { key: BoardRange; label: string }[] = [
  { key: "hari-ini", label: "Hari ini" },
  { key: "besok", label: "Besok" },
  { key: "semua", label: "Semua" },
];
const STATUSES = [
  { key: "", label: "Semua status" },
  { key: "dijadwalkan", label: "Dijadwalkan" },
  { key: "dimuat", label: "Sudah dimuat" },
  { key: "berangkat", label: "Dalam perjalanan" },
  { key: "tiba", label: "Tiba" },
  { key: "tertunda", label: "Tertunda" },
  { key: "terkirim", label: "Terkirim" },
  { key: "batal", label: "Batal" },
];

const wib = (t: number) => new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(t * 1000));

export default async function Muatan({ searchParams }: { searchParams: Promise<{ rentang?: string; status?: string; q?: string; ok?: string }> }) {
  const me = await requirePerm("muat");
  const sp = await searchParams;
  const range = RANGES.some((r) => r.key === sp.rentang) ? (sp.rentang as BoardRange) : "hari-ini";
  const status = STATUSES.some((s) => s.key === sp.status) ? (sp.status as string) : "";
  const q = (sp.q ?? "").trim();
  const office = can(me.roles, "pengiriman");
  const db = await getDb();
  const [jobs, poNotices, statusNotices, shift] = await Promise.all([
    boardJobs(db, { range, status, q }),
    unreadNotifications(db, ["po_baru"], 30),
    office ? unreadNotifications(db, ["dimuat", "status_kirim"], 15) : [],
    needsShift(me.roles) ? currentShift(db, me.id) : undefined,
  ]);
  const notice = (n: { id: string; kind: string; refId: string; title: string; message: string; createdAt: number }): NoticeItem => ({ id: n.id, kind: n.kind, refId: n.refId, title: n.title, message: n.message, when: wib(n.createdAt) });

  // Total muatan per barang untuk yang belum berangkat (dijadwalkan + sudah dimuat).
  const totals = new Map<string, { name: string; unit: string; qty: number }>();
  for (const j of jobs) {
    if (j.status !== "dijadwalkan" && j.status !== "dimuat") continue;
    for (const l of j.lines) {
      const k = `${l.name}|${l.unit}`;
      const t = totals.get(k) ?? { name: l.name, unit: l.unit, qty: 0 };
      t.qty += l.qty;
      totals.set(k, t);
    }
  }
  const now = today();
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(range !== "hari-ini" ? { rentang: range } : {}), ...(status ? { status } : {}), ...(q ? { q } : {}), ...patch });
    for (const [k, v] of [...p.entries()]) if (!v || (k === "rentang" && v === "hari-ini")) p.delete(k);
    const s = p.toString();
    return `/operasional/muatan${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <AutoRefresh seconds={15} />
      <PageHead title="Muatan" sub="Tugas muat dan pengiriman. Halaman ini memperbarui diri tiap 15 detik." />
      <Ok ok={sp.ok} />
      {needsShift(me.roles) && !shift && (
        <p className="alert alert-warn" style={{ marginBottom: 16 }}>
          Anda belum absen piket, jadi tombol “Sudah dimuat” akan ditolak. <Link href="/operasional/piket">Absen piket dulu</Link>.
        </p>
      )}
      <div className="stack" style={{ gap: 16 }}>
        <NotificationPanel title="PO baru perlu diperiksa / menunggu dimuat" items={poNotices.map(notice)} />
        {office && <NotificationPanel title="Pembaruan pengiriman" items={statusNotices.map(notice)} />}

        <form className="filter-bar mu-filter" method="get">
          <nav className="seg" aria-label="Rentang tanggal">
            {RANGES.map((r) => (
              <Link key={r.key} href={qs({ rentang: r.key })} aria-current={r.key === range ? "page" : undefined}>{r.label}</Link>
            ))}
          </nav>
          {range !== "hari-ini" && <input type="hidden" name="rentang" value={range} />}
          <div className="field">
            <label htmlFor="mu-status">Status</label>
            <select id="mu-status" name="status" defaultValue={status}>
              {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div className="field grow"><label htmlFor="mu-q">Cari</label><input id="mu-q" name="q" defaultValue={q} placeholder="nomor, pelanggan, tujuan, nopol, sopir" /></div>
          <button type="submit" className="btn btn-blue btn-sm">Tampilkan</button>
        </form>

        {totals.size > 0 && (
          <section className="admin-card">
            <div className="card-head"><h2>Total muatan belum berangkat</h2></div>
            <ul className="mu-totals">
              {[...totals.values()].sort((a, b) => a.name.localeCompare(b.name, "id")).map((t) => (
                <li key={`${t.name}|${t.unit}`}><b className="tabular">{formatQty(t.qty)} {t.unit}</b> · {t.name}</li>
              ))}
            </ul>
          </section>
        )}

        <div className="mu-grid">
          {jobs.map((j) => {
            const nav = navUrl(j);
            return (
              <article key={j.id} className={`mu-card is-${j.status}`}>
                <div className="mu-top">
                  <Link href={`/operasional/pengiriman/${j.id}`}><b>{j.number}</b></Link> <DeliveryStatusBadge s={j.status} />
                  <span className="mu-date">{j.date === now ? "Hari ini" : tgl(j.date)}{j.date < now && (j.status === "dijadwalkan" || j.status === "dimuat") ? " · terlambat" : ""}</span>
                </div>
                <div className="mu-who">{j.contactName}</div>
                <div className="mu-where">{j.project ? `${j.project} · ` : ""}{j.address.split("\n")[0] || "Diambil sendiri"}</div>
                <ul className="mu-lines">
                  {j.lines.map((l, i) => <li key={i}><b className="tabular">{formatQty(l.qty)} {l.unit}</b><span>{l.name}</span></li>)}
                </ul>
                <div className="mu-meta">
                  <span><Icon name="truck" size={15} /> {j.plate ?? "armada belum dipilih"}</span>
                  <span>{j.driver ?? "sopir belum dipilih"}</span>
                </div>
                {j.status === "tertunda" && j.delayReason && <p className="small text-warn">Tertunda: {j.delayReason}</p>}
                {nav && j.status !== "terkirim" && j.status !== "batal" && (
                  <div className="mu-links"><a href={nav} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm"><Icon name="route" size={16} /> Lihat di peta</a></div>
                )}
                {j.status === "dijadwalkan" && <LoadButton id={j.id} />}
                {j.status === "dimuat" && <p className="small muted">Sudah dimuat. Menunggu sopir berangkat.</p>}
              </article>
            );
          })}
        </div>
        {jobs.length === 0 && <p className="muted">Tidak ada tugas muat untuk pilihan ini.</p>}
      </div>
    </>
  );
}
