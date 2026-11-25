// Target produksi standar per produk (per hari) — padanan worker/productionTargets.ts di app.kirimistanablock.com.
// Target diisi sekali (mandor / QC / kantor) lalu dipakai otomatis tiap hari; bila hasil hari itu di bawah target,
// alasan wajib diisi di rekap. Genteng memakai satu target gabungan semua jenis.
// Kunci: genteng = "p|genteng||"; barang lain = "i|<id barang>". Kunci lama "cat|…" & "p|genteng|<jenis>|" disimpan sebagai riwayat (tidak tampil).
import { sql } from "drizzle-orm";
import type { DB } from "@/lib/erp/server";
import { addDays } from "@/lib/erp/util";
import { LINE_LABEL } from "@/lib/ops/production-lines";
import type { ProductLine } from "@/db/erp";

export const COMBINED_GENTENG_KEY = "p|genteng||";
export const GENTENG_LABEL = "Genteng Beton (semua jenis)";
export const isRetiredTargetKey = (key: string) => key.startsWith("cat|") || (key.startsWith("p|genteng|") && key !== COMBINED_GENTENG_KEY);
export const targetKeyOf = (item: { id: string; productionLine: string | null }) => (item.productionLine === "genteng" ? COMBINED_GENTENG_KEY : `i|${item.id}`);
export const achievement = (actual: number, target: number) => (target > 0 ? Math.round((actual / target) * 100) : null);

export type Standard = { key: string; label: string; unit: string; target: number; setByName: string | null; setAt: number; history: { target: number; byName: string | null; at: string }[]; group: string };
export type TargetDay = { key: string; label: string; unit: string; group: string; workDate: string; target: number; actual: number; reached: boolean; reason: string | null; reasonBy: string | null };
export type Suggestion = { key: string; label: string; unit: string; group: string; days: number; median: number; upper: number; max: number };

type DayRow = { key: string; label: string; unit: string; group: string; workDate: string; actual: number; rowTarget: number | null };

/** Kelompok tampilan: semua jenis paving → "Paving", genteng → "Genteng Beton", dst. */
/** Label kelompok seperti app lama ("Greffel", bukan "Gravel (Greffel)"). */
const GROUP_LABEL: Partial<Record<string, string>> = { greffel: "Greffel" };
const groupOf = (line: string | null, name: string) => (line && line in LINE_LABEL ? GROUP_LABEL[line] ?? LINE_LABEL[line as ProductLine] : name.split(" ")[0] || "Lainnya");

/** Hasil per produk (kunci target) per hari pada rentang tanggal. */
async function dailyTotals(db: DB, from: string, to: string): Promise<DayRow[]> {
  const rows = await db.all<{ date: string; target: number | null; itemId: string; name: string; unit: string; line: string | null; qty: number }>(sql`
    select p.date, p.target, i.id itemId, i.name, i.unit, i.production_line line, l.qty
      from inv_productions p join inv_production_lines l on l.production_id = p.id and l.role = 'hasil' join fin_items i on i.id = l.item_id
     where p.date >= ${from} and p.date <= ${to} and p.mix_part is null`);
  const days = new Map<string, DayRow>();
  for (const r of rows) {
    const key = targetKeyOf({ id: r.itemId, productionLine: r.line });
    const genteng = key === COMBINED_GENTENG_KEY;
    const id = `${key}#${r.date}`;
    const d = days.get(id) ?? { key, label: genteng ? GENTENG_LABEL : r.name, unit: r.unit, group: groupOf(r.line, r.name), workDate: r.date, actual: 0, rowTarget: null };
    d.actual += Number(r.qty) || 0;
    // Genteng: target per baris lama (per jenis) tidak dipakai — standar gabungan yang berlaku.
    if (!genteng && r.target && r.target > (d.rowTarget ?? 0)) d.rowTarget = r.target;
    days.set(id, d);
  }
  return [...days.values()];
}

export async function listStandards(db: DB): Promise<Standard[]> {
  const rows = await db.all<{ key: string; label: string; unit: string; target: number; setByName: string | null; setAt: number; history: string | null; line: string | null; name: string | null }>(sql`
    select t.key, t.label, t.unit, t.target, t.set_by_name setByName, t.set_at setAt, t.history, i.production_line line, i.name
      from inv_production_targets t left join fin_items i on t.key = 'i|' || i.id order by t.label`);
  return rows
    .filter((r) => !isRetiredTargetKey(r.key))
    .map((r) => ({
      key: r.key, label: r.name ?? r.label, unit: r.unit, target: Number(r.target), setByName: r.setByName, setAt: Number(r.setAt),
      history: (() => { try { return JSON.parse(r.history || "[]"); } catch { return []; } })(),
      group: r.key === COMBINED_GENTENG_KEY ? LINE_LABEL.genteng : groupOf(r.line, r.label),
    }));
}

const quantile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1) + 0.5))];
const roundHint = (v: number) => (v >= 100 ? Math.round(v / 10) * 10 : Math.round(v));

/** Rekap target: standar, saran dari data 30 hari terakhir, dan target vs realisasi per hari (dengan alasan). */
export async function targetOverview(db: DB, from: string, to: string) {
  const standards = await listStandards(db);
  const byKey = new Map(standards.map((s) => [s.key, s]));
  // Standar yang berlaku pada tanggal tsb (pakai riwayat bila standar diubah setelahnya).
  const standardOn = (key: string, workDate: string) => {
    const s = byKey.get(key);
    if (!s) return null;
    const end = Date.parse(`${workDate}T23:59:59+07:00`) / 1000;
    if (s.setAt <= end) return s.target;
    return s.history.find((h) => Date.parse(h.at) / 1000 <= end)?.target ?? null;
  };
  const [range, recent, reasons] = await Promise.all([
    dailyTotals(db, from, to),
    dailyTotals(db, addDays(to, -30), to),
    db.all<{ key: string; workDate: string; reason: string; by: string | null }>(sql`select key, work_date workDate, reason, created_by_name by from inv_production_target_reasons where work_date >= ${from} and work_date <= ${to}`),
  ]);
  const reasonOf = new Map(reasons.map((r) => [`${r.key}#${r.workDate}`, r]));
  const days: TargetDay[] = range
    .flatMap((d) => {
      const target = d.rowTarget ?? standardOn(d.key, d.workDate);
      if (!target) return [];
      const r = reasonOf.get(`${d.key}#${d.workDate}`);
      const actual = Math.round(d.actual * 100) / 100;
      return [{ key: d.key, label: d.label, unit: d.unit, group: d.group, workDate: d.workDate, target, actual, reached: actual >= target, reason: r?.reason ?? null, reasonBy: r?.by ?? null }];
    })
    .sort((a, b) => b.workDate.localeCompare(a.workDate) || a.label.localeCompare(b.label, "id"));
  // Saran: median & kuartil atas hasil harian 30 hari terakhir (hari dengan hasil > 0).
  const groups = new Map<string, Omit<Suggestion, "days" | "median" | "upper" | "max"> & { values: number[] }>();
  for (const d of recent) {
    if (d.actual <= 0) continue;
    const g = groups.get(d.key) ?? { key: d.key, label: d.label, unit: d.unit, group: d.group, values: [] };
    g.values.push(d.actual);
    groups.set(d.key, g);
  }
  const suggestions: Suggestion[] = [...groups.values()]
    .map(({ values, ...g }) => {
      const s = [...values].sort((a, b) => a - b);
      return { ...g, days: s.length, median: roundHint(quantile(s, 0.5)), upper: roundHint(quantile(s, 0.75)), max: roundHint(s[s.length - 1]) };
    })
    .sort((a, b) => b.days - a.days || a.label.localeCompare(b.label, "id"));
  return { standards, suggestions, days };
}
export type TargetOverview = Awaited<ReturnType<typeof targetOverview>>;
