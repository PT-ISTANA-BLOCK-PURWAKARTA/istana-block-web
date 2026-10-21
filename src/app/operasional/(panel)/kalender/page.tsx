import Link from "next/link";
import { Kpis, Ok, PageHead, RangeForm } from "@/components/erp/ui";
import { CalendarView } from "@/components/ops/calendar/CalendarView";
import { monthGrid, wibKey, wibTime, TYPE_LABEL, type EventView } from "@/components/ops/calendar/common";
import { RecapExport } from "@/components/ops/calendar/RecapExport";
import { PushToggle } from "@/components/ops/push/PushToggle";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import { addDays, isDate, tgl, today as todayWib } from "@/lib/erp/util";
import { getEvent, guestNames, listEvents, listRecap, type RecapItem } from "@/lib/ops/calendar";
import { can } from "@/lib/roles";
import "./kalender.css";

export const metadata = { title: "Kalender" };

type SP = { ok?: string; tab?: string; bulan?: string; tanggal?: string; acara?: string; from?: string; to?: string; jenis?: string };

/** Awal hari WIB (00.00) untuk tanggal YYYY-MM-DD. */
const wibStart = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - 7 * 3600_000);
const lastOfMonth = (month: string) => `${month}-${String(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate()).padStart(2, "0")}`;

export default async function Kalender({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requirePerm("kalender");
  const sp = await searchParams;
  const canManage = can(me.roles, "kalender_kelola");
  const tab = sp.tab === "rekap" ? "rekap" : "kalender";
  const now = todayWib();

  return (
    <>
      <PageHead title="Kalender" sub="Jadwal rapat & training. Peserta mendapat pengingat sebelum acara dimulai; hasilnya direkap di tab Rekap.">
        <nav className="seg" aria-label="Tampilan">
          <Link href="/operasional/kalender" aria-current={tab === "kalender" ? "page" : undefined}>Kalender</Link>
          <Link href="/operasional/kalender?tab=rekap" aria-current={tab === "rekap" ? "page" : undefined}>Rekap rapat &amp; training</Link>
        </nav>
        {canManage && tab === "kalender" && <Link href={`/operasional/kalender/baru?tanggal=${isDate(sp.tanggal) && sp.tanggal >= now ? sp.tanggal : now}`} className="btn btn-primary btn-sm">+ Tambah acara</Link>}
      </PageHead>
      <Ok ok={sp.ok} />
      <div style={{ marginBottom: 16 }}><PushToggle description="Aktifkan agar pengingat rapat & training muncul di HP/komputer ini." /></div>
      {tab === "rekap" ? <RecapTab sp={sp} meId={me.id} canManage={canManage} canIso={can(me.roles, "iso")} now={now} /> : <CalendarTab sp={sp} meId={me.id} canManage={canManage} now={now} />}
    </>
  );
}

async function CalendarTab({ sp, meId, canManage, now }: { sp: SP; meId: number; canManage: boolean; now: string }) {
  const db = await getDb();
  const deep = sp.acara ? await getEvent(db, meId, sp.acara) : null;
  const deepDay = deep ? wibKey(deep.startAt) : null;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.bulan ?? "") ? sp.bulan! : (deepDay ?? now).slice(0, 7);
  const selected = isDate(sp.tanggal) && sp.tanggal.slice(0, 7) === month ? sp.tanggal : deepDay && deepDay.slice(0, 7) === month ? deepDay : now.slice(0, 7) === month ? now : `${month}-01`;
  // Satu kueri untuk kotak bulan (42 hari) sekaligus agenda 60 hari ke depan.
  const grid = monthGrid(month);
  const fromDay = grid[0] < now ? grid[0] : now;
  const toDay = addDays(now, 61) > addDays(grid[41], 1) ? addDays(now, 61) : addDays(grid[41], 1);
  const list = await listEvents(db, meId, wibStart(fromDay), new Date(wibStart(toDay).getTime() - 1));
  const events: EventView[] = deep && !list.some((e) => e.id === deep.id) ? [...list, deep] : list;
  return <CalendarView key={month} month={month} today={now} events={events} canManage={canManage} initialDay={selected} initialEvent={deep?.id ?? null} />;
}

async function RecapTab({ sp, meId, canManage, canIso, now }: { sp: SP; meId: number; canManage: boolean; canIso: boolean; now: string }) {
  const from = isDate(sp.from) ? sp.from : `${now.slice(0, 7)}-01`;
  let to = isDate(sp.to) ? sp.to : lastOfMonth(now.slice(0, 7));
  if (to < from) to = from;
  if (to > addDays(from, 366)) to = addDays(from, 366);
  const type = sp.jenis === "rapat" || sp.jenis === "training" ? sp.jenis : "semua";
  const db = await getDb();
  const all = await listRecap(db, meId, wibStart(from), new Date(wibStart(addDays(to, 1)).getTime() - 1));
  const items = all.filter((i) => type === "semua" || i.type === type);

  const y = Number(now.slice(0, 4));
  const m = Number(now.slice(5, 7));
  const monthStart = (offset: number) => { const d = new Date(Date.UTC(y, m - 1 + offset, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
  const presets = [
    { label: "Bulan ini", from: `${monthStart(0)}-01`, to: lastOfMonth(monthStart(0)) },
    { label: "Bulan lalu", from: `${monthStart(-1)}-01`, to: lastOfMonth(monthStart(-1)) },
    { label: "3 bulan", from: `${monthStart(-2)}-01`, to: lastOfMonth(monthStart(0)) },
    { label: "Tahun ini", from: `${y}-01-01`, to: `${y}-12-31` },
  ];
  const q = (extra: Record<string, string>) => new URLSearchParams({ tab: "rekap", from, to, ...extra }).toString();
  const nowMs = Date.now();
  const stat = {
    rapat: all.filter((i) => i.type === "rapat"), training: all.filter((i) => i.type === "training"),
    open: all.flatMap((i) => i.decisions).filter((d) => d.values.status === "Open").length,
    pending: all.filter((i) => !i.result && new Date(i.startAt).getTime() < nowMs).length,
  };

  return (
    <>
      <RangeForm from={from} to={to} extra={<input type="hidden" name="tab" value="rekap" />} />
      <nav className="seg" aria-label="Rentang cepat" style={{ marginBottom: 14 }}>
        {presets.map((p) => <Link key={p.label} href={`/operasional/kalender?${new URLSearchParams({ tab: "rekap", from: p.from, to: p.to })}`} aria-current={p.from === from && p.to === to ? "page" : undefined}>{p.label}</Link>)}
      </nav>
      <Kpis items={[
        { label: "Rapat", value: `${stat.rapat.filter((i) => i.result).length}/${stat.rapat.length}`, sub: "notulen sudah diisi" },
        { label: "Training", value: `${stat.training.filter((i) => i.result).length}/${stat.training.length}`, sub: "hasil sudah diisi" },
        { label: "Keputusan Open", value: stat.open, sub: "tindak lanjut belum selesai", tone: stat.open ? "warn" : undefined },
        { label: "Belum direkap", value: stat.pending, sub: "acara yang sudah lewat", tone: stat.pending ? "warn" : undefined },
      ]} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", margin: "16px 0 12px" }}>
        <nav className="seg" aria-label="Jenis acara">
          {(["semua", "rapat", "training"] as const).map((t) => <Link key={t} href={`/operasional/kalender?${q(t === "semua" ? {} : { jenis: t })}`} aria-current={type === t ? "page" : undefined}>{t === "semua" ? "Semua" : TYPE_LABEL[t]}</Link>)}
        </nav>
        <span style={{ display: "inline-flex", gap: 12, alignItems: "center" }}>
          {canIso && <Link href="/operasional/rekap-iso?tab=form&form=F-IB-14" className="small" style={{ fontWeight: 600 }}>Lihat form F-IB-14 di Rekap ISO &rarr;</Link>}
          <RecapExport items={items} from={from} to={to} />
        </span>
      </div>
      <div className="stack" style={{ gap: 10 }}>
        {items.map((i) => <RecapCard key={i.id} item={i} canManage={canManage} nowMs={nowMs} />)}
        {items.length === 0 && <p className="cal-empty">Tidak ada rapat atau training pada periode ini.</p>}
      </div>
    </>
  );
}

function RecapCard({ item, canManage, nowMs }: { item: RecapItem; canManage: boolean; nowMs: number }) {
  const r = item.result;
  const day = wibKey(item.startAt);
  const presentCount = r ? r.attendees.filter((a) => a.present).length + guestNames(r.guests).length : null;
  const open = item.decisions.filter((d) => d.values.status === "Open").length;
  const late = item.decisions.some((d) => d.values.ketepatan === "TERLAMBAT");
  const past = new Date(item.startAt).getTime() < nowMs;
  return (
    <article className={`cal-recap cal-tone-${item.type}`}>
      <div className="when"><span>{tgl(day).split(" ")[1]}</span><b>{Number(day.slice(8))}</b><span>{wibTime(item.startAt)}</span></div>
      <div className="body">
        <div className="cal-tags" style={{ marginTop: 0 }}>
          <span className="cal-tag">{TYPE_LABEL[item.type]}{r?.category ? ` · ${r.category}` : ""}</span>
          <b>{item.title}</b>
        </div>
        <p className="small muted" style={{ marginTop: 2 }}>
          {item.location ? `${item.location} · ` : ""}
          {r?.leader ? `${item.type === "rapat" ? "Pimpinan" : "Pemateri"}: ${r.leader} · ` : ""}
          {presentCount !== null ? `${presentCount} hadir dari ${item.participants.length} diundang` : `${item.participants.length} diundang`}
        </p>
        {r?.summary && <p className="small clamp-2" style={{ marginTop: 4 }}>{r.summary}</p>}
        {item.decisions.length > 0 && (
          <p className="small" style={{ marginTop: 4 }}>
            {item.decisions.length} keputusan &middot; <b className={open ? "text-warn" : "text-sukses"}>{open} Open</b>
            {late && <b className="text-bahaya"> &middot; ada yang TERLAMBAT</b>}
          </p>
        )}
        {r && r.files.length > 0 && <div className="files">{r.files.map((f) => <a key={f.key} href={`/operasional/berkas/${f.key}`} target="_blank" rel="noreferrer">{f.name}</a>)}</div>}
      </div>
      <div className="side">
        {r ? <span className="badge badge-on">Sudah diisi</span> : <span className={`badge ${past ? "badge-warn" : "badge-off"}`}>{past ? "Belum diisi" : "Akan datang"}</span>}
        {canManage && <Link href={`/operasional/kalender/hasil/${item.id}`} className="btn btn-ghost btn-sm">{r ? "Ubah hasil" : "Isi hasil"}</Link>}
        {r?.filledByName && <span className="small muted">oleh {r.filledByName}</span>}
      </div>
    </article>
  );
}
