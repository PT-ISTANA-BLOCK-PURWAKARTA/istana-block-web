// Inti laporan pimpinan (harian / mingguan / bulanan, WIB). Dipakai halaman /operasional/laporan (lewat summary.ts)
// DAN cron (cron/summary.ts). Karena itu TANPA "server-only" dan TANPA alias "@/": impor relatif saja, db diterima sebagai argumen.
//
// Semua agregasi dikerjakan di SQL (batas CPU Workers Free 10 ms): hanya daftar kecil (produk, kendala, benda uji)
// yang diolah di JavaScript. Periode = [awal, akhir) menurut WIB; tanggal bisnis berupa teks YYYY-MM-DD, kejadian berupa detik unix.
import { sql } from "drizzle-orm";
import type { OpsDb } from "./push";
import { periodRange, PERIOD_LABELS, wibDate, type Period } from "./shared/period";
import { evaluateSample } from "./shared/strength";

export { PERIOD_LABELS, type Period };

export type QtyItem = { name: string; unit: string; quantity: number; count: number };
export type Issue = { issue: string; count: number; notes: string[] };

type Window = { from: number; to: number; start: string; end: string };

/** Angka-angka tunggal satu periode (juga dipakai untuk periode pembanding). */
export type Scalars = {
  created: number; customers: number; delivered: number; late: number; cancelled: number;
  prodEntries: number; rejects: number; issueDays: number;
  trips: number; rejectedTrips: number; suppliers: number;
  sandTests: number; avgSilt: number | null; overLimit: number; goodSilt: number;
  mixLogs: number; mixOk: number; mixWaiting: number;
};

const ZERO_SCALARS: Scalars = {
  created: 0, customers: 0, delivered: 0, late: 0, cancelled: 0, prodEntries: 0, rejects: 0, issueDays: 0,
  trips: 0, rejectedTrips: 0, suppliers: 0, sandTests: 0, avgSilt: null, overLimit: 0, goodSilt: 0, mixLogs: 0, mixOk: 0, mixWaiting: 0,
};

const seconds = (d: Date) => Math.floor(d.getTime() / 1000);
/** Nilai kolom SQL "issues" (JSON teks) → daftar kendala. */
const issueList = (raw: unknown): string[] => {
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
};

/** Satu kueri berisi semua angka tunggal periode (sub-kueri berkorelasi ke CTE jendela waktu). */
async function scalars(db: OpsDb, w: Window): Promise<Scalars> {
  const row = await db.get<Record<keyof Scalars, number | null>>(sql`
    select
      (select count(*) from ops_orders where status <> 'draft' and created_at >= ${w.from} and created_at < ${w.to}) as created,
      (select count(distinct contact_id) from ops_orders where status <> 'draft' and created_at >= ${w.from} and created_at < ${w.to}) as customers,
      (select count(*) from ops_deliveries where status = 'terkirim' and delivered_at >= ${w.from} and delivered_at < ${w.to}) as delivered,
      (select count(*) from ops_deliveries d join ops_orders o on o.id = d.order_id
        where d.status = 'terkirim' and d.delivered_at >= ${w.from} and d.delivered_at < ${w.to}
          and coalesce(o.requested_date, '') <> '' and date(d.delivered_at + 25200, 'unixepoch') > o.requested_date) as late,
      (select count(*) from ops_orders where status = 'batal' and cancelled_at >= ${w.from} and cancelled_at < ${w.to}) as cancelled,
      (select count(*) from inv_productions where date >= ${w.start} and date < ${w.end}) as prodEntries,
      (select coalesce(sum(rejects), 0) from inv_productions where date >= ${w.start} and date < ${w.end}) as rejects,
      (select count(distinct date) from inv_productions where date >= ${w.start} and date < ${w.end} and coalesce(issues, '[]') not in ('[]', '')) as issueDays,
      (select count(*) from ops_goods_receipts where received_at >= ${w.from} and received_at < ${w.to}) as trips,
      (select count(*) from ops_goods_receipts where status = 'ditolak' and received_at >= ${w.from} and received_at < ${w.to}) as rejectedTrips,
      (select count(distinct supplier) from ops_goods_receipts where coalesce(supplier, '') <> '' and received_at >= ${w.from} and received_at < ${w.to}) as suppliers,
      (select count(*) from qc_sand_tests where status = 'selesai' and silt_percent is not null and tested_at >= ${w.from} and tested_at < ${w.to}) as sandTests,
      (select avg(silt_percent) from qc_sand_tests where status = 'selesai' and silt_percent is not null and tested_at >= ${w.from} and tested_at < ${w.to}) as avgSilt,
      (select count(*) from qc_sand_tests where status = 'selesai' and silt_percent > max_silt_percent and tested_at >= ${w.from} and tested_at < ${w.to}) as overLimit,
      (select count(*) from qc_sand_tests where status = 'selesai' and silt_percent <= 5 and tested_at >= ${w.from} and tested_at < ${w.to}) as goodSilt,
      (select count(*) from qc_mix_logs where work_date >= ${w.start} and work_date < ${w.end}) as mixLogs,
      (select count(*) from qc_mix_logs where status = 'sesuai' and work_date >= ${w.start} and work_date < ${w.end}) as mixOk,
      (select count(*) from qc_mix_logs where review_status = 'menunggu' and work_date >= ${w.start} and work_date < ${w.end}) as mixWaiting`);
  if (!row) return ZERO_SCALARS;
  const n = (k: keyof Scalars) => Number(row[k] ?? 0);
  return {
    created: n("created"), customers: n("customers"), delivered: n("delivered"), late: n("late"), cancelled: n("cancelled"),
    prodEntries: n("prodEntries"), rejects: n("rejects"), issueDays: n("issueDays"),
    trips: n("trips"), rejectedTrips: n("rejectedTrips"), suppliers: n("suppliers"),
    sandTests: n("sandTests"), avgSilt: row.avgSilt == null ? null : Math.round(Number(row.avgSilt) * 100) / 100, overLimit: n("overLimit"), goodSilt: n("goodSilt"),
    mixLogs: n("mixLogs"), mixOk: n("mixOk"), mixWaiting: n("mixWaiting"),
  };
}

const toItems = (rows: { name: string; unit: string | null; quantity: number | null; cnt: number }[]): QtyItem[] =>
  rows.map((r) => ({ name: r.name, unit: r.unit ?? "", quantity: Number(r.quantity ?? 0), count: Number(r.cnt) }));

/** Produk yang dipesan pada PO baru periode ini. */
const orderedProducts = (db: OpsDb, w: Window) =>
  db.all<{ name: string; unit: string | null; quantity: number | null; cnt: number }>(sql`
    select coalesce(nullif(i.name, ''), nullif(l.description, ''), 'Lainnya') as name, l.unit as unit, sum(l.qty) as quantity, count(*) as cnt
    from ops_order_lines l join ops_orders o on o.id = l.order_id left join fin_items i on i.id = l.item_id
    where o.status <> 'draft' and o.created_at >= ${w.from} and o.created_at < ${w.to}
    group by 1, 2 order by cnt desc, quantity desc`);

/** Produk yang benar-benar terkirim (per baris surat jalan berstatus terkirim). */
const deliveredProducts = (db: OpsDb, w: Window) =>
  db.all<{ name: string; unit: string | null; quantity: number | null; cnt: number }>(sql`
    select coalesce(nullif(i.name, ''), nullif(ol.description, ''), 'Lainnya') as name, coalesce(nullif(ol.unit, ''), i.unit, '') as unit,
           sum(dl.qty) as quantity, count(distinct d.id) as cnt
    from ops_delivery_lines dl join ops_deliveries d on d.id = dl.delivery_id
         left join ops_order_lines ol on ol.id = dl.order_line_id left join fin_items i on i.id = dl.item_id
    where d.status = 'terkirim' and d.delivered_at >= ${w.from} and d.delivered_at < ${w.to}
    group by 1, 2 order by cnt desc, quantity desc`);

/** Barang jadi yang dihasilkan (baris hasil dokumen produksi). */
const producedProducts = (db: OpsDb, w: Window) =>
  db.all<{ name: string; unit: string | null; quantity: number | null; cnt: number }>(sql`
    select i.name as name, i.unit as unit, sum(pl.qty) as quantity, count(distinct p.id) as cnt
    from inv_production_lines pl join inv_productions p on p.id = pl.production_id join fin_items i on i.id = pl.item_id
    where pl.role = 'hasil' and p.date >= ${w.start} and p.date < ${w.end}
    group by i.id order by cnt desc, quantity desc`);

/** Kendala produksi (kecil: hanya dokumen yang punya kendala). */
async function productionIssues(db: OpsDb, w: Window): Promise<Issue[]> {
  const rows = await db.all<{ issues: string | null; note: string | null }>(sql`
    select issues, note from inv_productions
    where date >= ${w.start} and date < ${w.end} and coalesce(issues, '[]') not in ('[]', '')`);
  const map = new Map<string, Issue>();
  for (const row of rows) {
    for (const issue of issueList(row.issues)) {
      const entry = map.get(issue) ?? { issue, count: 0, notes: [] };
      entry.count += 1;
      if (row.note) entry.notes.push(row.note);
      map.set(issue, entry);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

const receivedItems = (db: OpsDb, w: Window) =>
  db.all<{ name: string; unit: string | null; quantity: number | null; cnt: number }>(sql`
    select item_name as name, unit as unit, sum(quantity) as quantity, count(*) as cnt
    from ops_goods_receipts where status = 'diterima' and received_at >= ${w.from} and received_at < ${w.to}
    group by lower(item_name), unit order by cnt desc, quantity desc`);

/** Laporan uji kuat tekan periode ini + benda ujinya, dinilai dengan evaluateSample. */
async function strengthSummary(db: OpsDb, w: Window) {
  const rows = await db.all<{ id: string; grade: string; sid: string | null; madeAt: string | null; testedAt: string | null; maxLoadKn: number | null; areaCm2: number | null }>(sql`
    select t.id as id, t.concrete_grade as grade, s.id as sid, s.made_at as madeAt, s.tested_at as testedAt, s.max_load_kn as maxLoadKn, s.area_cm2 as areaCm2
    from qc_strength_tests t left join qc_strength_samples s on s.test_id = t.id
    where t.report_date >= ${w.start} and t.report_date < ${w.end}`);
  let samples = 0, passed = 0, failed = 0;
  for (const r of rows) {
    if (!r.sid) continue;
    samples += 1;
    const result = evaluateSample(r.grade, r);
    if (result.passed === true) passed += 1;
    else if (result.passed === false) failed += 1;
  }
  return { reports: new Set(rows.map((r) => r.id)).size, samples, passed, failed };
}

/** Jam piket per orang pada periode (shift yang masih berjalan dihitung sampai sekarang, paling lama 24 jam). */
async function dutyHours(db: OpsDb, w: Window, nowSec: number) {
  const rows = await db.all<{ name: string; shifts: number; secs: number }>(sql`
    select user_name as name, count(*) as shifts,
           sum(min(coalesce(ended_at, ${nowSec}), started_at + 86400) - started_at) as secs
    from ops_duty_shifts where started_at >= ${w.from} and started_at < ${w.to}
    group by user_id, user_name order by secs desc`);
  return rows.map((r) => ({ name: r.name, shifts: Number(r.shifts), hours: Math.round(Number(r.secs ?? 0) / 3600) }));
}

export type BuildOptions = {
  /** Ringkas (untuk cron): hanya angka tunggal, hasil produksi, dan kendala. Daftar lain & periode pembanding dikosongkan. */
  brief?: boolean;
};

export async function buildSummary(db: OpsDb, input: { period: Period; day: string }, options: BuildOptions = {}) {
  const range = periodRange(input.period, input.day);
  const w: Window = { from: seconds(range.from), to: seconds(range.to), start: range.start, end: range.end };
  const before: Window = { from: seconds(range.previousFrom), to: seconds(range.previousTo), start: wibDate(range.previousFrom), end: range.start };
  const nowSec = Math.floor(Date.now() / 1000);
  const brief = options.brief === true;

  const [current, produced, issues] = await Promise.all([scalars(db, w), producedProducts(db, w), productionIssues(db, w)]);
  const full = brief
    ? null
    : await Promise.all([
        scalars(db, before),
        orderedProducts(db, w),
        deliveredProducts(db, w),
        receivedItems(db, w),
        strengthSummary(db, w),
        dutyHours(db, w, nowSec),
        db.get<{ inTransit: number; mixWaitingAcc: number }>(sql`
          select (select count(*) from ops_deliveries where status = 'berangkat') as inTransit,
                 (select count(*) from qc_mix_logs where review_status = 'menunggu') as mixWaitingAcc`),
      ]);
  const [previous, ordered, delivered, received, strength, duty, now] = full ?? [ZERO_SCALARS, [], [], [], { reports: 0, samples: 0, passed: 0, failed: 0 }, [], undefined];

  return {
    period: input.period,
    day: input.day,
    label: range.label,
    start: range.start,
    /** Batas akhir EKSKLUSIF (hari pertama periode berikutnya). */
    end: range.end,
    generatedAt: Date.now(),
    brief,
    current: {
      orders: {
        created: current.created, delivered: current.delivered, late: current.late, onTime: current.delivered - current.late, cancelled: current.cancelled,
        customers: current.customers, orderedProducts: toItems(ordered), deliveredProducts: toItems(delivered),
      },
      production: { entries: current.prodEntries, products: toItems(produced), rejects: current.rejects, issueDays: current.issueDays, issues },
      receipts: { trips: current.trips, rejected: current.rejectedTrips, items: toItems(received), suppliers: current.suppliers },
      sand: { tests: current.sandTests, avgSilt: current.avgSilt, overLimit: current.overLimit, good: current.goodSilt },
      mix: { logs: current.mixLogs, ok: current.mixOk, waiting: current.mixWaiting },
    },
    previous: {
      orders: { created: previous.created, delivered: previous.delivered, late: previous.late, cancelled: previous.cancelled },
      production: { entries: previous.prodEntries, rejects: previous.rejects, issueDays: previous.issueDays },
      receipts: { trips: previous.trips, rejected: previous.rejectedTrips },
      sand: { tests: previous.sandTests, avgSilt: previous.avgSilt },
      mix: { logs: previous.mixLogs },
    },
    strength,
    now: { inTransit: Number(now?.inTransit ?? 0), mixWaitingAcc: Number(now?.mixWaitingAcc ?? 0) },
    duty,
  };
}
export type Summary = Awaited<ReturnType<typeof buildSummary>>;

const fmt = (value: number) => value.toLocaleString("id-ID", { maximumFractionDigits: 2 });
const list = (items: { name: string; unit: string; quantity: number }[], max = 3) =>
  items.slice(0, max).map((item) => `${item.name} ${fmt(item.quantity)} ${item.unit}`.trim()).join(", ");

/** Teks singkat untuk notifikasi HP pimpinan. */
export function summaryMessage(summary: Summary) {
  const { orders: o, production: p, receipts: r, sand: s } = summary.current;
  return [
    `PO baru ${o.created} · terkirim ${o.delivered}${o.late ? ` (${o.late} telat)` : ""}${o.cancelled ? ` · batal ${o.cancelled}` : ""}`,
    p.products.length ? `Produksi: ${list(p.products)}${p.issues.length ? ` · kendala: ${p.issues.map((item) => item.issue).join(", ")}` : ""}` : "Produksi: belum ada input",
    r.trips ? `Barang masuk ${r.trips} rit${r.rejected ? ` (${r.rejected} ditolak)` : ""}${s.avgSilt !== null ? ` · lumpur rata² ${fmt(s.avgSilt)}%` : ""}` : "Barang masuk: tidak ada",
  ].join("\n");
}
