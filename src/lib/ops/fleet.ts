import "server-only";

import { and, asc, desc, eq, gte, isNotNull, lte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { daysBetween, isDate } from "@/lib/erp/util";
import {
  FLEET_KIND_BY_KEY,
  isCounted,
  isTempoPayment,
  tripCostKey,
  type FleetKind,
} from "@/lib/ops/shared/fleet";

export interface FleetExpenseRow {
  id: string;
  entryDate: string;
  vehicleId: string | null;
  vehicleLabel: string;
  driverName: string;
  kind: string;
  item: string;
  qty: number;
  price: number;
  total: number;
  shop: string;
  mechanic: string;
  place: string;
  destination: string;
  payment: string;
  fund: string;
  note: string;
  party: string;
  photoKeys: string[];
  approvalStatus: string;
  approvedBy: number | null;
  approvedByName: string;
  approvedAt: string | null;
  approvalNote: string;
  subcategory: string;
  tripRef: string;
  dueDate: string;
  tempoPaidAt: string | null;
  tempoPaidByName: string;
  tempoRemindedOn: string;
  sourceKey: string;
  createdBy: number | null;
  createdByName: string;
  updatedByName: string;
  createdAt: string | null;
}

export interface FleetVehicleRow {
  id: string;
  plate: string;
  name: string;
  capacity: string;
  active: boolean;
  tag: string;
  stnkExpiry: string | null;
  kirExpiry: string | null;
  lastOil: string | null;
  lastDriver: string | null;
}

export interface FleetKpis {
  sewa: number;
  pendapatan: number;
  biaya: number;
  profit: number;
  danaCepiIn: number;
  danaCepiOut: number;
  tempoUnpaidCount: number;
  tempoUnpaidTotal: number;
  menungguAccCount: number;
  menungguAccTotal: number;
}

export interface SubcategoryRow {
  kind: string;
  kindLabel: string;
  subcategory: string;
  count: number;
  total: number;
  income: boolean;
}

export interface TripGroup {
  tripRef: string;
  entryDate: string;
  vehicleId: string | null;
  vehicleLabel: string;
  driverName: string;
  destination: string;
  payment: string;
  fund: string;
  dueDate: string;
  tempoPaidAt: string | null;
  tempoPaidByName: string;
  note: string;
  photoKeys: string[];
  approvalStatus: string;
  costs: Record<string, number>;
  total: number;
  rows: FleetExpenseRow[];
}

export interface TempoGroup {
  key: string;
  isTrip: boolean;
  id: string | null;
  tripRef: string;
  entryDate: string;
  dueDate: string;
  daysLeft: number | null;
  overdue: boolean;
  dueSoon: boolean;
  vehicleId: string | null;
  vehicleLabel: string;
  shop: string;
  party: string;
  item: string;
  payment: string;
  fund: string;
  total: number;
}

export interface FleetAlert {
  vehicleId: string;
  plate: string;
  name: string;
  type: "stnk" | "kir" | "oli";
  label: string;
  dueDate: string;
  daysLeft: number;
  urgent: boolean;
}

function toIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (d instanceof Date) return Number.isNaN(d.getTime()) ? null : d.toISOString();
  return String(d);
}

/** Daftar catatan biaya & pendapatan armada dalam rentang tanggal (inklusif). */
export async function listFleetExpenses(range?: { from?: string; to?: string }): Promise<FleetExpenseRow[]> {
  const db = await getDb();
  const cond = [];
  if (range?.from && isDate(range.from)) cond.push(gte(schema.fleetExpenses.entryDate, range.from));
  if (range?.to && isDate(range.to)) cond.push(lte(schema.fleetExpenses.entryDate, range.to));

  const rows = await db
    .select()
    .from(schema.fleetExpenses)
    .where(cond.length ? and(...cond) : undefined)
    .orderBy(desc(schema.fleetExpenses.entryDate), desc(schema.fleetExpenses.createdAt));

  return rows.map((r) => ({
    id: r.id,
    entryDate: r.entryDate,
    vehicleId: r.vehicleId ?? null,
    vehicleLabel: r.vehicleLabel ?? "",
    driverName: r.driverName ?? "",
    kind: r.kind,
    item: r.item,
    qty: Number(r.qty ?? 1),
    price: Number(r.price ?? 0),
    total: Number(r.total ?? 0),
    shop: r.shop ?? "",
    mechanic: r.mechanic ?? "",
    place: r.place ?? "",
    destination: r.destination ?? "",
    payment: r.payment ?? "",
    fund: r.fund ?? "ib",
    note: r.note ?? "",
    party: r.party ?? "",
    photoKeys: Array.isArray(r.photoKeys) ? r.photoKeys : [],
    approvalStatus: r.approvalStatus || "ok",
    approvedBy: r.approvedBy ?? null,
    approvedByName: r.approvedByName ?? "",
    approvedAt: toIso(r.approvedAt),
    approvalNote: r.approvalNote ?? "",
    subcategory: r.subcategory ?? "",
    tripRef: r.tripRef ?? "",
    dueDate: r.dueDate ?? "",
    tempoPaidAt: toIso(r.tempoPaidAt),
    tempoPaidByName: r.tempoPaidByName ?? "",
    tempoRemindedOn: r.tempoRemindedOn ?? "",
    sourceKey: r.sourceKey ?? "",
    createdBy: r.createdBy ?? null,
    createdByName: r.createdByName ?? "",
    updatedByName: r.updatedByName ?? "",
    createdAt: toIso(r.createdAt),
  }));
}

/** Daftar kendaraan armada beserta tanggal ganti oli terakhir & supir terakhir. */
export async function listFleetVehicles(): Promise<FleetVehicleRow[]> {
  const db = await getDb();
  const [vehRows, oilRows, delivRows, driverRows] = await Promise.all([
    db.select().from(schema.vehicles).orderBy(asc(schema.vehicles.plate)),
    db
      .select({ vehicleId: schema.fleetExpenses.vehicleId, entryDate: schema.fleetExpenses.entryDate })
      .from(schema.fleetExpenses)
      .where(and(eq(schema.fleetExpenses.kind, "oli"), isNotNull(schema.fleetExpenses.vehicleId)))
      .orderBy(desc(schema.fleetExpenses.entryDate)),
    db
      .select({
        vehicleId: schema.deliveries.vehicleId,
        driverId: schema.deliveries.driverId,
        date: schema.deliveries.date,
      })
      .from(schema.deliveries)
      .orderBy(desc(schema.deliveries.date)),
    db.select({ id: schema.drivers.id, name: schema.drivers.name }).from(schema.drivers),
  ]);

  const oilByVeh = new Map<string, string>();
  for (const r of oilRows) {
    if (r.vehicleId && !oilByVeh.has(r.vehicleId)) oilByVeh.set(r.vehicleId, r.entryDate);
  }

  const driverNameById = new Map(driverRows.map((d) => [d.id, d.name]));
  const lastDriverByVeh = new Map<string, string>();
  for (const d of delivRows) {
    if (d.vehicleId && d.driverId && !lastDriverByVeh.has(d.vehicleId)) {
      const nm = driverNameById.get(d.driverId);
      if (nm) lastDriverByVeh.set(d.vehicleId, nm);
    }
  }

  return vehRows.map((v) => ({
    id: v.id,
    plate: v.plate,
    name: v.name,
    capacity: v.capacity,
    active: v.active,
    tag: v.tag ?? "",
    stnkExpiry: v.stnkExpiry ?? null,
    kirExpiry: v.kirExpiry ?? null,
    lastOil: oilByVeh.get(v.id) ?? null,
    lastDriver: lastDriverByVeh.get(v.id) ?? null,
  }));
}

/** Hitung KPI ringkasan armada dari baris terfilter. */
export function computeFleetKpis(rows: ReadonlyArray<FleetExpenseRow>): FleetKpis {
  let sewa = 0;
  let pendapatan = 0;
  let biaya = 0;
  let danaCepiIn = 0;
  let danaCepiOut = 0;
  let tempoUnpaidCount = 0;
  let tempoUnpaidTotal = 0;
  let menungguAccCount = 0;
  let menungguAccTotal = 0;

  for (const r of rows) {
    if (r.approvalStatus === "menunggu") {
      menungguAccCount += 1;
      menungguAccTotal += r.total;
      continue;
    }
    if (!isCounted(r)) continue;

    if (r.kind === "sewa") {
      sewa += r.total;
    } else if (r.kind === "pendapatan") {
      pendapatan += r.total;
      if (r.fund === "cepi" && !r.payment.toLowerCase().startsWith("belum")) {
        danaCepiIn += r.total;
      }
    } else {
      biaya += r.total;
      if (r.fund === "cepi") danaCepiOut += r.total;
      if (isTempoPayment(r.payment) && !r.tempoPaidAt) {
        tempoUnpaidCount += 1;
        tempoUnpaidTotal += r.total;
      }
    }
  }

  return {
    sewa,
    pendapatan,
    biaya,
    profit: sewa + pendapatan - biaya,
    danaCepiIn,
    danaCepiOut,
    tempoUnpaidCount,
    tempoUnpaidTotal,
    menungguAccCount,
    menungguAccTotal,
  };
}

/** Ringkasan pengeluaran & pendapatan berdasarkan jenis dan subkategori. */
export function summarizeBySubcategory(rows: ReadonlyArray<FleetExpenseRow>): SubcategoryRow[] {
  const map = new Map<string, SubcategoryRow>();
  for (const r of rows) {
    if (!isCounted(r)) continue;
    const info = FLEET_KIND_BY_KEY[r.kind as FleetKind];
    const sub = r.subcategory || "(Tanpa subkategori)";
    const key = `${r.kind}::${sub}`;
    let row = map.get(key);
    if (!row) {
      row = {
        kind: r.kind,
        kindLabel: info?.label || r.kind,
        subcategory: sub,
        count: 0,
        total: 0,
        income: info?.income === true,
      };
      map.set(key, row);
    }
    row.count += 1;
    row.total += r.total;
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

/** Kelompokkan catatan perjalanan yang memiliki `tripRef`. */
export function summarizeByTrip(rows: ReadonlyArray<FleetExpenseRow>): TripGroup[] {
  const map = new Map<string, TripGroup>();
  for (const r of rows) {
    if (!r.tripRef) continue;
    let g = map.get(r.tripRef);
    if (!g) {
      g = {
        tripRef: r.tripRef,
        entryDate: r.entryDate,
        vehicleId: r.vehicleId,
        vehicleLabel: r.vehicleLabel,
        driverName: r.driverName,
        destination: r.destination,
        payment: r.payment,
        fund: r.fund,
        dueDate: r.dueDate,
        tempoPaidAt: r.tempoPaidAt,
        tempoPaidByName: r.tempoPaidByName,
        note: r.note,
        photoKeys: [...r.photoKeys],
        approvalStatus: r.approvalStatus,
        costs: {},
        total: 0,
        rows: [],
      };
      map.set(r.tripRef, g);
    }
    const ck = tripCostKey(r.kind);
    g.costs[ck] = (g.costs[ck] || 0) + r.total;
    if (isCounted(r)) g.total += r.total;
    if (r.approvalStatus === "menunggu") g.approvalStatus = "menunggu";
    if (!g.dueDate && r.dueDate) g.dueDate = r.dueDate;
    if (!g.tempoPaidAt && r.tempoPaidAt) {
      g.tempoPaidAt = r.tempoPaidAt;
      g.tempoPaidByName = r.tempoPaidByName;
    }
    g.rows.push(r);
  }
  return [...map.values()].sort((a, b) => b.entryDate.localeCompare(a.entryDate));
}

/** Tagihan tempo yang belum lunas (dikelompokkan per trip jika berasal dari perjalanan). */
export function getOpenTempoItems(rows: ReadonlyArray<FleetExpenseRow>, todayDate: string): TempoGroup[] {
  const map = new Map<string, TempoGroup>();
  for (const r of rows) {
    if (!isCounted(r)) continue;
    if (r.kind === "sewa" || r.kind === "pendapatan") continue;
    if (!isTempoPayment(r.payment) || r.tempoPaidAt) continue;

    const isTrip = Boolean(r.tripRef);
    const key = isTrip ? `trip:${r.tripRef}` : `id:${r.id}`;
    const due = r.dueDate || r.entryDate;
    const dl = isDate(due) && isDate(todayDate) ? daysBetween(todayDate, due) : null;
    const overdue = dl !== null && dl < 0;
    const dueSoon = dl !== null && dl >= 0 && dl <= 3;

    const existing = map.get(key);
    if (existing) {
      existing.total += r.total;
      if (!existing.dueDate && r.dueDate) existing.dueDate = r.dueDate;
    } else {
      map.set(key, {
        key,
        isTrip,
        id: isTrip ? null : r.id,
        tripRef: r.tripRef,
        entryDate: r.entryDate,
        dueDate: r.dueDate,
        daysLeft: dl,
        overdue,
        dueSoon,
        vehicleId: r.vehicleId,
        vehicleLabel: r.vehicleLabel,
        shop: r.shop,
        party: r.party,
        item: isTrip ? `Perjalanan ${r.destination || r.tripRef}` : r.item,
        payment: r.payment,
        fund: r.fund,
        total: r.total,
      });
    }
  }
  return [...map.values()].sort((a, b) => (a.dueDate || a.entryDate).localeCompare(b.dueDate || b.entryDate));
}

/** Peringatan STNK, KIR (<= 30 hari / kedaluwarsa), dan oli (> 60 hari). */
export function getFleetAlerts(vehicles: ReadonlyArray<FleetVehicleRow>, todayDate: string): FleetAlert[] {
  const alerts: FleetAlert[] = [];
  if (!isDate(todayDate)) return alerts;

  for (const v of vehicles) {
    if (!v.active) continue;
    if (v.stnkExpiry && isDate(v.stnkExpiry)) {
      const left = daysBetween(todayDate, v.stnkExpiry);
      if (left <= 30) {
        alerts.push({
          vehicleId: v.id,
          plate: v.plate,
          name: v.name,
          type: "stnk",
          label: left < 0 ? `STNK lewat ${Math.abs(left)} hari` : `STNK jatuh tempo ${left} hari lagi`,
          dueDate: v.stnkExpiry,
          daysLeft: left,
          urgent: left <= 7,
        });
      }
    }
    if (v.kirExpiry && isDate(v.kirExpiry)) {
      const left = daysBetween(todayDate, v.kirExpiry);
      if (left <= 30) {
        alerts.push({
          vehicleId: v.id,
          plate: v.plate,
          name: v.name,
          type: "kir",
          label: left < 0 ? `KIR lewat ${Math.abs(left)} hari` : `KIR jatuh tempo ${left} hari lagi`,
          dueDate: v.kirExpiry,
          daysLeft: left,
          urgent: left <= 7,
        });
      }
    }
    if (v.lastOil && isDate(v.lastOil)) {
      const age = daysBetween(v.lastOil, todayDate);
      if (age >= 60) {
        alerts.push({
          vehicleId: v.id,
          plate: v.plate,
          name: v.name,
          type: "oli",
          label: `Ganti oli terakhir ${age} hari lalu`,
          dueDate: v.lastOil,
          daysLeft: -age,
          urgent: age >= 90,
        });
      }
    }
  }
  return alerts.sort((a, b) => a.daysLeft - b.daysLeft);
}
