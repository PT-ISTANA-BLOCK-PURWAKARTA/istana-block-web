// Data papan "Muatan & tugas sopir" — padanan monitor.* di app.kirimistanablock.com:
// kartu tugas (dimuat hari ini / orderan / dalam perjalanan / selesai), status sopir, jadwal mingguan, absensi sopir,
// rekap orderan selesai, barang keluar (muatan), dan rekap perjalanan sopir per minggu.
import { sql } from "drizzle-orm";
import type { DB } from "@/lib/erp/server";
import { deliveryItems } from "@/lib/erp/ops";
import { addDays, today } from "@/lib/erp/util";

const WIB = 7 * 3600;
/** Awal hari WIB (unix detik) untuk tanggal yyyy-mm-dd. */
export const dayStart = (day: string) => Date.parse(`${day}T00:00:00Z`) / 1000 - WIB;
export const wibDay = (sec: number) => new Date((sec + WIB) * 1000).toISOString().slice(0, 10);
/** Senin dari minggu tanggal ini (yyyy-mm-dd). */
export const mondayOf = (day: string) => addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));

export type MuatJob = {
  id: string; number: string; date: string; status: string; orderId: string; orderNumber: string; isInternal: number;
  contactName: string; project: string; address: string; mapsUrl: string; note: string;
  driver: string | null; driverPhone: string | null; plate: string | null; vehicleName: string | null;
  loadedAt: number | null; loadedByName: string | null; loadNote: string | null; departedAt: number | null; arrivedAt: number | null; deliveredAt: number | null;
  delayReason: string | null; lines: { name: string; qty: number; unit: string }[];
};

/** Barang per surat jalan; pengiriman hasil impor lama tanpa baris muatan memakai baris PO-nya. */
async function linesFor(db: DB, rows: { id: string; orderId: string }[]) {
  const out = await deliveryItems(db, rows.map((r) => r.id));
  const missing = [...new Set(rows.filter((r) => !out.get(r.id)?.length).map((r) => r.orderId))];
  const byOrder = new Map<string, { name: string; qty: number; unit: string }[]>();
  for (let i = 0; i < missing.length; i += 80) {
    const part = missing.slice(i, i + 80);
    const got = await db.all<{ orderId: string; name: string; qty: number; unit: string }>(sql`
      select l.order_id orderId, coalesce(it.name, l.description, '') name, l.qty, coalesce(nullif(l.unit, ''), it.unit, '') unit
        from ops_order_lines l left join fin_items it on it.id = l.item_id where l.order_id in (${sql.join(part.map((p) => sql`${p}`), sql`, `)})`);
    for (const g of got) byOrder.set(g.orderId, [...(byOrder.get(g.orderId) ?? []), { name: g.name, qty: g.qty, unit: g.unit }]);
  }
  for (const r of rows) if (!out.get(r.id)?.length) out.set(r.id, byOrder.get(r.orderId) ?? []);
  return out;
}

export type MuatGroup = "muat" | "orderan" | "jalan" | "selesai";
export type DayFilter = "hari-ini" | "besok" | "semua";

/** Kartu tugas untuk satu tab. Pencarian mencakup PO, pelanggan, barang, alamat, sopir, dan nopol. */
export async function muatJobs(db: DB, o: { group: MuatGroup; day: DayFilter; q: string }): Promise<MuatJob[]> {
  const now = today();
  const nowSec = Math.floor(Date.now() / 1000);
  const where =
    o.group === "muat"
      ? sql`d.loaded_at >= ${dayStart(now)} and d.status <> 'batal'`
      : o.group === "orderan"
        ? sql`d.status = 'dijadwalkan' and ${o.day === "hari-ini" ? sql`d.date <= ${now}` : o.day === "besok" ? sql`d.date = ${addDays(now, 1)}` : sql`1 = 1`}`
        : o.group === "jalan"
          ? sql`d.status in ('dimuat','berangkat','tertunda')`
          : sql`d.status in ('tiba','terkirim') and coalesce(d.delivered_at, d.arrived_at, d.updated_at) >= ${nowSec - 86400}`;
  const like = `%${o.q}%`;
  const rows = await db.all<Omit<MuatJob, "lines">>(sql`
    select d.id, d.number, d.date, d.status, o.id orderId, o.number orderNumber, o.is_internal isInternal, c.name contactName, o.project, o.address, o.maps_url mapsUrl,
           coalesce(o.note, '') note, dr.name driver, dr.phone driverPhone, v.plate, v.name vehicleName,
           d.loaded_at loadedAt, d.loaded_by_name loadedByName, d.load_note loadNote, d.departed_at departedAt, d.arrived_at arrivedAt, d.delivered_at deliveredAt, d.delay_reason delayReason
      from ops_deliveries d join ops_orders o on o.id = d.order_id join fin_contacts c on c.id = o.contact_id
      left join ops_drivers dr on dr.id = d.driver_id left join ops_vehicles v on v.id = d.vehicle_id
     where ${where}
       ${o.q ? sql`and (d.number like ${like} or o.number like ${like} or c.name like ${like} or o.address like ${like} or dr.name like ${like} or v.plate like ${like}
                 or exists (select 1 from ops_delivery_lines dl join fin_items it on it.id = dl.item_id where dl.delivery_id = d.id and it.name like ${like}))` : sql``}
     order by d.date, d.number limit 200`);
  const items = await linesFor(db, rows);
  return rows.map((r) => ({ ...r, lines: items.get(r.id) ?? [] }));
}

/** Jumlah per tab (tanpa filter cari), untuk angka di tombol tab. */
export async function muatCounts(db: DB, day: DayFilter) {
  const now = today();
  const nowSec = Math.floor(Date.now() / 1000);
  const r = await db.get<{ muat: number; orderan: number; jalan: number; selesai: number }>(sql`
    select (select count(*) from ops_deliveries where loaded_at >= ${dayStart(now)} and status <> 'batal') muat,
           (select count(*) from ops_deliveries where status = 'dijadwalkan' and ${day === "hari-ini" ? sql`date <= ${now}` : day === "besok" ? sql`date = ${addDays(now, 1)}` : sql`1 = 1`}) orderan,
           (select count(*) from ops_deliveries where status in ('dimuat','berangkat','tertunda')) jalan,
           (select count(*) from ops_deliveries where status in ('tiba','terkirim') and coalesce(delivered_at, arrived_at, updated_at) >= ${nowSec - 86400}) selesai`);
  return r ?? { muat: 0, orderan: 0, jalan: 0, selesai: 0 };
}

/** Total per barang & satuan + jumlah rit. */
export function loadTotals(jobs: { status?: string; lines: { name: string; qty: number; unit: string }[] }[]) {
  const map = new Map<string, { name: string; unit: string; qty: number; trips: number }>();
  for (const j of jobs) {
    if (j.status === "batal") continue;
    const seen = new Set<string>();
    for (const l of j.lines) {
      const k = `${l.name}|${l.unit}`;
      const t = map.get(k) ?? { name: l.name || "-", unit: l.unit, qty: 0, trips: 0 };
      t.qty += l.qty;
      if (!seen.has(k)) { t.trips += 1; seen.add(k); }
      map.set(k, t);
    }
  }
  return [...map.values()].sort((a, b) => b.trips - a.trips || a.name.localeCompare(b.name, "id"));
}

// ---------- Sopir: jadwal harian, status, absensi ----------

export const DRIVER_DAY = ["aktif", "istirahat", "libur"] as const;
export type DriverDay = (typeof DRIVER_DAY)[number];
export type ScheduleEntry = { driverId: string; day: string; status: DriverDay; untilTime: string | null; note: string | null; setByName: string | null; updatedAt: number | null };

export async function scheduleWeek(db: DB, from: string, to: string) {
  const [drivers, entries] = await Promise.all([
    db.all<{ id: string; name: string; phone: string }>(sql`select id, name, phone from ops_drivers where active = 1 order by name`),
    db.all<ScheduleEntry>(sql`select driver_id driverId, day, status, until_time untilTime, note, set_by_name setByName, updated_at updatedAt from ops_driver_schedules where day >= ${from} and day <= ${to}`),
  ]);
  return { drivers, entries };
}

/** Status sopir hari ini: jadwal, tugas berjalan, notifikasi HP, posisi GPS terakhir. */
export async function driverStatusBoard(db: DB) {
  const now = today();
  const [drivers, todays, tasks, devices, positions] = await Promise.all([
    db.all<{ id: string; name: string; phone: string; userId: number | null }>(sql`
      select dr.id, dr.name, dr.phone, (select min(u.id) from users u where u.driver_id = dr.id) userId from ops_drivers dr where dr.active = 1 order by dr.name`),
    db.all<ScheduleEntry>(sql`select driver_id driverId, day, status, until_time untilTime, note, set_by_name setByName, updated_at updatedAt from ops_driver_schedules where day = ${now}`),
    db.all<{ driverId: string; status: string; orderNumber: string; plate: string | null }>(sql`
      select d.driver_id driverId, d.status, o.number orderNumber, v.plate from ops_deliveries d join ops_orders o on o.id = d.order_id left join ops_vehicles v on v.id = d.vehicle_id
       where d.driver_id is not null and d.status in ('dijadwalkan','dimuat','berangkat','tiba','tertunda') order by d.updated_at desc`),
    db.all<{ userId: number; lastSentAt: number | null; lastResult: string | null; lastTitle: string | null }>(sql`select user_id userId, last_sent_at lastSentAt, last_result lastResult, last_title lastTitle from ops_push_subscriptions`),
    db.all<{ userId: number; at: number }>(sql`select user_id userId, max(at) at from ops_positions where user_id is not null group by user_id`),
  ]);
  const posBy = new Map(positions.map((p) => [p.userId, p.at]));
  return drivers.map((d) => {
    const phones = devices.filter((x) => d.userId !== null && x.userId === d.userId);
    const last = phones.filter((x) => x.lastSentAt).sort((a, b) => (b.lastSentAt ?? 0) - (a.lastSentAt ?? 0))[0] ?? null;
    return {
      ...d,
      today: todays.find((t) => t.driverId === d.id) ?? null,
      tasks: tasks.filter((t) => t.driverId === d.id),
      devices: phones.length,
      lastPush: last ? { at: last.lastSentAt, result: last.lastResult, title: last.lastTitle } : null,
      lastPositionAt: d.userId ? posBy.get(d.userId) ?? null : null,
    };
  });
}
export type DriverStatusRow = Awaited<ReturnType<typeof driverStatusBoard>>[number];

export const ATTENDANCE_KINDS = ["hadir", "istirahat", "terlambat", "pulang", "sakit", "izin", "alfa", "libur", "belum"] as const;
export type AttendanceKind = (typeof ATTENDANCE_KINDS)[number];
export function attendanceKind(e: { status: string; note: string | null } | undefined): AttendanceKind {
  if (!e) return "belum";
  if (e.status === "aktif") return "hadir";
  if (e.status === "istirahat") return "istirahat";
  const note = (e.note ?? "").toLowerCase();
  if (/alfa|alpa|mangkir|tanpa (ket|kabar)/.test(note)) return "alfa";
  if (/sakit/.test(note)) return "sakit";
  if (/izin|ijin|cuti/.test(note)) return "izin";
  if (/pulang/.test(note)) return "pulang";
  if (/belum datang|terlambat|telat/.test(note)) return "terlambat";
  return "libur";
}

/** Rekap absensi sopir dari status harian. Jumat tanpa isian = libur pabrik; hari setelah hari ini tidak dihitung. */
export async function driverAttendance(db: DB, from: string, to: string) {
  const now = today();
  const last = to < now ? to : now;
  const days: string[] = [];
  for (let d = from; d <= last && days.length < 93; d = addDays(d, 1)) days.push(d);
  if (!days.length) return { days, rows: [] };
  const start = dayStart(days[0]);
  const [drivers, entries, trips] = await Promise.all([
    db.all<{ id: string; name: string }>(sql`select id, name from ops_drivers where active = 1 order by name`),
    db.all<{ driverId: string; day: string; status: string; note: string | null; untilTime: string | null }>(sql`
      select driver_id driverId, day, status, note, until_time untilTime from ops_driver_schedules where day >= ${days[0]} and day <= ${days[days.length - 1]}`),
    db.all<{ driverId: string; at: number }>(sql`
      select driver_id driverId, coalesce(loaded_at, departed_at, updated_at) at from ops_deliveries where driver_id is not null and status <> 'batal' and coalesce(loaded_at, departed_at, updated_at) >= ${start}
      union all
      select driver_id, out_at from ops_vehicle_trips where driver_id is not null and delivery_id is null and out_at >= ${start}`),
  ]);
  const isFriday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay() === 5;
  const rows = drivers.map((dr) => {
    const counts = Object.fromEntries(ATTENDANCE_KINDS.map((k) => [k, 0])) as Record<AttendanceKind, number>;
    const daily: Record<string, { kind: AttendanceKind; note: string | null; trips: number }> = {};
    let workDays = 0;
    let tripTotal = 0;
    for (const day of days) {
      const e = entries.find((x) => x.driverId === dr.id && x.day === day);
      const n = trips.filter((t) => t.driverId === dr.id && t.at && wibDay(Number(t.at)) === day).length;
      tripTotal += n;
      if (isFriday(day) && !e && !n) { daily[day] = { kind: "libur", note: "Jumat", trips: 0 }; continue; }
      const kind = attendanceKind(e);
      counts[kind]++;
      if (kind !== "libur" && kind !== "belum") workDays++;
      daily[day] = { kind, note: e?.note ?? (e?.status === "istirahat" && e.untilTime ? `s/d ${e.untilTime}` : null), trips: n };
    }
    const present = counts.hadir + counts.istirahat + counts.pulang + counts.terlambat;
    return { id: dr.id, name: dr.name, workDays, counts, present, trips: tripTotal, attendance: workDays ? present / workDays : null, daily };
  });
  return { days, rows };
}

// ---------- Rekap ----------

/** Orderan yang tiba / selesai pada rentang (per barang, per sopir). */
export async function finishedJobs(db: DB, from: string, to: string) {
  const rows = await db.all<{ id: string; orderId: string; orderNumber: string; isInternal: number; contactName: string; driver: string | null; plate: string | null; doneAt: number }>(sql`
    select d.id, o.id orderId, o.number orderNumber, o.is_internal isInternal, c.name contactName, dr.name driver, v.plate, coalesce(d.delivered_at, d.arrived_at) doneAt
      from ops_deliveries d join ops_orders o on o.id = d.order_id join fin_contacts c on c.id = o.contact_id
      left join ops_drivers dr on dr.id = d.driver_id left join ops_vehicles v on v.id = d.vehicle_id
     where d.status in ('tiba','terkirim') and coalesce(d.delivered_at, d.arrived_at) >= ${dayStart(from)} and coalesce(d.delivered_at, d.arrived_at) < ${dayStart(to) + 86400}
     order by doneAt desc limit 1000`);
  const items = await linesFor(db, rows);
  return rows.map((r) => ({ ...r, lines: items.get(r.id) ?? [] }));
}

/** Barang keluar karena muatan: jumlah dimuat per barang pada rentang tanggal muat, dibanding jumlah pesanan. */
export async function stockOut(db: DB, from: string, to: string) {
  return db.all<{ name: string; unit: string; loaded: number; ordered: number; trips: number }>(sql`
    select coalesce(it.name, '-') name, coalesce(nullif(ol.unit, ''), it.unit, '') unit, sum(dl.qty) loaded, sum(ol.qty) ordered, count(distinct d.id) trips
      from ops_deliveries d join ops_delivery_lines dl on dl.delivery_id = d.id join ops_order_lines ol on ol.id = dl.order_line_id left join fin_items it on it.id = dl.item_id
     where d.status <> 'batal' and d.loaded_at >= ${dayStart(from)} and d.loaded_at < ${dayStart(to) + 86400}
     group by 1, 2 order by loaded desc`);
}

/** Rekap perjalanan sopir per minggu (Senin–Minggu): jumlah jalan per hari, total, selesai. */
export async function weeklyTrips(db: DB, weekStart: string) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const rows = await db.all<{ driverId: string; name: string; plate: string | null; at: number; done: number }>(sql`
    select d.driver_id driverId, dr.name, v.plate, coalesce(d.departed_at, d.loaded_at) at, case when d.status in ('tiba','terkirim') then 1 else 0 end done
      from ops_deliveries d join ops_drivers dr on dr.id = d.driver_id left join ops_vehicles v on v.id = d.vehicle_id
     where d.status <> 'batal' and coalesce(d.departed_at, d.loaded_at) >= ${dayStart(days[0])} and coalesce(d.departed_at, d.loaded_at) < ${dayStart(days[6]) + 86400}`);
  const by = new Map<string, { name: string; plates: Set<string>; perDay: number[]; total: number; done: number }>();
  for (const r of rows) {
    const e = by.get(r.driverId) ?? { name: r.name, plates: new Set<string>(), perDay: days.map(() => 0), total: 0, done: 0 };
    const i = days.indexOf(wibDay(r.at));
    if (i >= 0) e.perDay[i]++;
    if (r.plate) e.plates.add(r.plate);
    e.total++;
    e.done += r.done;
    by.set(r.driverId, e);
  }
  const drivers = [...by.values()].map((e) => ({ ...e, plates: [...e.plates] })).sort((a, b) => b.total - a.total);
  return { days, drivers, total: rows.length };
}
