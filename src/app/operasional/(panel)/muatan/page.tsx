import "./muatan.css";
import "@/components/ops/home/home.css";
import Link from "next/link";
import { Ok } from "@/components/erp/ui";
import { AutoRefresh } from "@/components/ops/delivery/AutoRefresh";
import { NotificationPanel, type NoticeItem } from "@/components/ops/delivery/NotificationPanel";
import { DriverAttendanceBoard, DriverScheduleBoard, DriverStatusBoard } from "@/components/ops/muatan/DriverPanels";
import { JobCard, TotalsCard } from "@/components/ops/muatan/JobCard";
import { FinishedRecap, StockOutPanel, WeeklyTripRecap } from "@/components/ops/muatan/RecapPanels";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import { addDays, isDate, today } from "@/lib/erp/util";
import { unreadNotifications } from "@/lib/ops/deliveries";
import { currentShift } from "@/lib/ops/duty";
import {
  driverAttendance, driverStatusBoard, finishedJobs, loadTotals, mondayOf, muatCounts, muatJobs, scheduleWeek, stockOut, weeklyTrips,
  type DayFilter, type MuatGroup,
} from "@/lib/ops/muatanBoard";
import { can, needsShift } from "@/lib/roles";
import Gerbang from "../gerbang/page";

export const metadata = { title: "Muatan & tugas sopir" };
export const dynamic = "force-dynamic";

type Tab = MuatGroup | "gerbang" | "status" | "jadwal" | "absensi" | "rekap";
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "muat", label: "Dimuat hari ini", icon: "📦" },
  { key: "orderan", label: "Orderan", icon: "📋" },
  { key: "jalan", label: "Dalam perjalanan", icon: "🚚" },
  { key: "selesai", label: "Selesai", icon: "✅" },
  { key: "gerbang", label: "Keluar-masuk mobil", icon: "🧭" },
  { key: "status", label: "Status sopir", icon: "👤" },
  { key: "jadwal", label: "Jadwal sopir", icon: "📅" },
  { key: "absensi", label: "Absensi sopir", icon: "🛡️" },
  { key: "rekap", label: "Rekap", icon: "📊" },
];
const DAYS: { key: DayFilter; label: string }[] = [
  { key: "hari-ini", label: "Hari ini" },
  { key: "besok", label: "Besok" },
  { key: "semua", label: "Semua" },
];
const EMPTY: Record<MuatGroup, (d: DayFilter) => string> = {
  muat: () => "Belum ada barang yang dimuat hari ini.",
  orderan: (d) => (d === "hari-ini" ? "Tidak ada orderan yang menunggu dimuat hari ini." : d === "besok" ? "Belum ada orderan untuk besok." : "Tidak ada orderan yang menunggu dimuat."),
  jalan: () => "Tidak ada sopir yang sedang di perjalanan.",
  selesai: () => "Belum ada orderan selesai dalam 24 jam terakhir.",
};

const wib = (t: number) => new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(t * 1000));

type SP = { tab?: string; hari?: string; q?: string; ok?: string; dari?: string; sampai?: string; minggu?: string; sopir?: string; status?: string; rinci?: string };

export default async function Muatan({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requirePerm("muat");
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "orderan";
  const day: DayFilter = DAYS.some((d) => d.key === sp.hari) ? (sp.hari as DayFilter) : "hari-ini";
  const q = (sp.q ?? "").trim().slice(0, 80);
  const office = can(me.roles, "pengiriman");
  const canLoad = !me.roles.includes("ekspedisi") || can(me.roles, "pengiriman");
  const canSet = can(me.roles, "muat") || office || can(me.roles, "ekspedisi");
  const now = today();
  const db = await getDb();
  const jobTab = tab === "muat" || tab === "orderan" || tab === "jalan" || tab === "selesai";
  // Rentang tanggal: Selesai = 7 hari terakhir, Rekap barang keluar & Absensi = bulan ini.
  const from = isDate(sp.dari ?? "") ? sp.dari! : tab === "selesai" ? addDays(now, -6) : `${now.slice(0, 7)}-01`;
  const to = isDate(sp.sampai ?? "") ? sp.sampai! : now;
  const week = mondayOf(isDate(sp.minggu ?? "") ? sp.minggu! : now);

  const [counts, jobs, notices, shift] = await Promise.all([
    muatCounts(db, day),
    jobTab ? muatJobs(db, { group: tab, day, q }) : Promise.resolve([]),
    tab === "orderan" ? unreadNotifications(db, ["po_baru"], 20) : Promise.resolve([]),
    needsShift(me.roles) ? currentShift(db, me.id) : Promise.resolve(undefined),
  ]);
  const notice = (n: { id: string; kind: string; refId: string; title: string; message: string; createdAt: number }): NoticeItem => ({ id: n.id, kind: n.kind, refId: n.refId, title: n.title, message: n.message, when: wib(n.createdAt) });
  const tabCount: Partial<Record<Tab, number>> = counts;
  const href = (p: Record<string, string>) => {
    const s = new URLSearchParams(Object.entries({ tab, ...(day !== "hari-ini" ? { hari: day } : {}), ...(q ? { q } : {}), ...p }).filter(([, v]) => v));
    return `/operasional/muatan?${s}`;
  };

  let body: React.ReactNode = null;
  if (jobTab) {
    const finished = tab === "selesai" ? await finishedJobs(db, from, to) : [];
    body = (
      <>
        {tab === "orderan" && (
          <>
            <NotificationPanel title="PO baru perlu diperiksa / menunggu dimuat" items={notices.map(notice)} />
            <nav className="mj-days" aria-label="Hari">
              {DAYS.map((d) => <Link key={d.key} href={href({ hari: d.key === "hari-ini" ? "" : d.key })} aria-current={d.key === day ? "page" : undefined}>{d.label}</Link>)}
            </nav>
            <TotalsCard title={`Menunggu dimuat ${day === "hari-ini" ? "hari ini" : day === "besok" ? "besok" : "(semua)"}`} totals={loadTotals(jobs)} />
          </>
        )}
        {tab === "muat" && <TotalsCard title="Barang dimuat hari ini" totals={loadTotals(jobs)} />}
        {tab === "jalan" && <p className="small muted">Sudah dimuat &amp; belum tiba: menunggu berangkat, sedang di jalan, atau terlambat.</p>}
        {tab === "selesai" && (
          <>
            <FinishedRecap rows={finished} from={from} to={to} />
            <p className="mj-label">Selesai 24 jam terakhir</p>
          </>
        )}
        {jobs.length ? (
          <div className="mj-grid">{jobs.map((j) => <JobCard key={j.id} j={j} canLoad={canLoad} office={office} />)}</div>
        ) : (
          <div className="ohome-card mj-empty">📋<p className="small muted">{EMPTY[tab](day)}</p></div>
        )}
      </>
    );
  } else if (tab === "gerbang") {
    body = <Gerbang />;
  } else if (tab === "status") {
    body = <DriverStatusBoard drivers={await driverStatusBoard(db)} canSet={canSet} office={office} />;
  } else if (tab === "jadwal") {
    const { drivers, entries } = await scheduleWeek(db, week, addDays(week, 6));
    body = <DriverScheduleBoard drivers={drivers} entries={entries} week={week} canSet={canSet} pick={{ driverId: sp.sopir, day: sp.hari && isDate(sp.hari) ? sp.hari : undefined, ...(sp.status ? { status: sp.status } : {}) }} />;
  } else if (tab === "absensi") {
    body = <DriverAttendanceBoard data={await driverAttendance(db, from, to)} from={from} to={to} detail={sp.rinci === "1"} />;
  } else {
    const [out, trips] = await Promise.all([stockOut(db, from, to), office ? weeklyTrips(db, week) : null]);
    body = (
      <>
        <StockOutPanel rows={out} from={from} to={to} />
        {trips && <WeeklyTripRecap data={trips} week={week} from={from} to={to} />}
        {office && <p className="small muted">Rekap petugas jaga (shift, jam jaga, muatan dikonfirmasi) ada di <Link href="/operasional/piket">Piket</Link>.</p>}
      </>
    );
  }

  return (
    <div className="ohome">
      {jobTab && <AutoRefresh seconds={15} />}
      <header className="ohome-head">
        <div>
          <p className="ohome-kicker" style={{ color: "#1f6b72" }}>Mandor &amp; Satpam</p>
          <h1>Muatan &amp; tugas sopir</h1>
          <p className="ohome-lead">Barang yang dimuat hari ini, orderan yang menunggu, sopir di perjalanan, orderan selesai, dan rekapnya. Diperbarui otomatis setiap 15 detik.</p>
        </div>
        <Link href={href({})} className="btn btn-ghost btn-sm">↻ Segarkan</Link>
      </header>
      <Ok ok={sp.ok} />
      {needsShift(me.roles) && !shift && (
        <p className="alert alert-warn">Anda belum absen piket, jadi tombol “Sudah dimuat” akan ditolak. <Link href="/operasional/piket">Absen piket dulu</Link>.</p>
      )}

      <nav className="mj-tabs" aria-label="Bagian muatan">
        {TABS.map((t) => (
          <Link key={t.key} href={`/operasional/muatan?tab=${t.key}`} aria-current={t.key === tab ? "page" : undefined}>
            <span aria-hidden="true">{t.icon}</span> {t.label}
            {tabCount[t.key] !== undefined && <span className="mj-count">{tabCount[t.key]}</span>}
          </Link>
        ))}
      </nav>

      {jobTab && (
        <form method="get" className="mj-search">
          <input type="hidden" name="tab" value={tab} />
          {day !== "hari-ini" && <input type="hidden" name="hari" value={day} />}
          <input name="q" defaultValue={q} aria-label="Cari orderan" placeholder="🔍 Cari PO, pelanggan, barang, sopir, atau plat nomor..." />
          {q && <Link href={href({ q: "" })} aria-label="Hapus pencarian">✕</Link>}
        </form>
      )}

      {body}
    </div>
  );
}
