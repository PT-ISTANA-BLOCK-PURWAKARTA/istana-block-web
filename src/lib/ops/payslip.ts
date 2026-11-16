import { and, desc, eq, gte, like, lte, or, sql } from "drizzle-orm";
import type { getDb } from "@/db";
import { items, kasbonEntries, payslips, productionLines, productions, transfers } from "@/db/erp";
import { users } from "@/db/schema";
import type { Settings } from "@/lib/settings";
import type { SheetData } from "@/lib/ops/excel";

type DB = Awaited<ReturnType<typeof getDb>>;

export type PayKind = "mingguan" | "bulanan";

export type EarningLine = {
  quantity: number;
  description: string;
  rate: number;
  amount: number;
  /** True bila baris berasal dari format impor lama `{ amount, description }` tanpa quantity/rate. */
  legacy?: boolean;
};

export type DeductionLine = {
  description: string;
  amount: number;
};

export type PayslipView = {
  id: string;
  employeeName: string;
  slipDate: string;
  payKind: PayKind | null;
  periodFrom: string | null;
  periodTo: string | null;
  earnings: EarningLine[];
  deductions: DeductionLine[];
  kasbonNote: string | null;
  note: string | null;
  signerId: number | null;
  signerName: string | null;
  signerSignatureKey: string | null;
  createdBy: number | null;
  createdByName: string | null;
  updatedAt: string;
};

export type PayGroupItem = {
  description: string;
  quantity: number;
  unit: string;
  days: number;
};

export type PayGroup = {
  leader: string;
  items: PayGroupItem[];
};

export type SignerOption = {
  id: number;
  name: string;
  signatureKey: string | null;
};

export type KasbonBalance = {
  name: string;
  kasbon: number;
  bayar: number;
  sisa: number;
};

export const PAY_KIND_LABEL: Record<PayKind, string> = {
  mingguan: "Mingguan",
  bulanan: "Bulanan",
};

/** Tanggal hari ini (YYYY-MM-DD) menurut zona waktu Jakarta (WIB). */
export function toDay(d: Date = new Date()): string {
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
}

/** Tambah/kurangi hari pada tanggal YYYY-MM-DD secara aman tanpa pergeseran zona waktu. */
export function addDays(day: string, delta: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  const ms = Date.parse(`${day}T12:00:00Z`) + delta * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Hari Kamis pada/setelah tanggal acuan (4 = Kamis). */
export function nextThursday(fromDay: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDay)) return fromDay;
  const dow = new Date(`${fromDay}T12:00:00Z`).getUTCDay();
  const delta = (4 - dow + 7) % 7;
  return addDays(fromDay, delta);
}

/** Tanggal 1 berikutnya (atau hari itu sendiri bila sudah tanggal 1). */
export function nextFirst(fromDay: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDay)) return fromDay;
  if (fromDay.endsWith("-01")) return fromDay;
  const [y, m] = fromDay.split("-").map(Number);
  const next = new Date(Date.UTC(y, m, 1));
  return next.toISOString().slice(0, 10);
}

/** Hitung rentang periode baku dari jenis gajian & tanggal slip: mingguan = Jumat–Kamis (7 hari), bulanan = bulan kalender sebelumnya. */
export function payPeriod(kind: PayKind, slipDate: string): { from: string; to: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slipDate)) return { from: slipDate, to: slipDate };
  if (kind === "mingguan") {
    return { from: addDays(slipDate, -6), to: slipDate };
  }
  const [y, m] = slipDate.split("-").map(Number);
  const prevLast = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
  return { from: `${prevLast.slice(0, 8)}01`, to: prevLast };
}

/** Format rentang tanggal ringkas Indonesia, mis. "06 Nov – 12 Nov 2026". */
export function periodText(from?: string | null, to?: string | null): string {
  if (!from && !to) return "-";
  const fmtShort = (d: string, withYear: boolean) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    return new Date(`${d}T12:00:00Z`).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      ...(withYear ? { year: "numeric" } : {}),
      timeZone: "UTC",
    });
  };
  if (from && to) {
    if (from === to) return fmtShort(from, true);
    const sameYear = from.slice(0, 4) === to.slice(0, 4);
    return `${fmtShort(from, !sameYear)} – ${fmtShort(to, true)}`;
  }
  return fmtShort((from ?? to)!, true);
}

export function periodPresets(todayStr: string = toDay()): { label: string; from: string; to: string }[] {
  const thu = nextThursday(todayStr);
  const prevThu = addDays(thu, -7);
  const monthStart = `${todayStr.slice(0, 7)}-01`;
  const [y, m] = todayStr.split("-").map(Number);
  const prevMonthEnd = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
  const prevMonthStart = `${prevMonthEnd.slice(0, 8)}01`;
  return [
    { label: "Kamis ini", from: thu, to: thu },
    { label: "Kamis lalu", from: prevThu, to: prevThu },
    { label: "Bulan ini", from: monthStart, to: todayStr > thu ? todayStr : thu },
    { label: "Bulan lalu", from: prevMonthStart, to: prevMonthEnd },
    { label: "Semua", from: "", to: "" },
  ];
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const cleaned = value.trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Parser baris pendapatan yang kompatibel mundur:
 * mendukung format baru `{ quantity, description, rate, amount? }` maupun format impor lama `{ amount, description }`.
 */
export function parseEarningLine(raw: Record<string, unknown>): EarningLine {
  const description = String(raw.description ?? "").trim();
  const rawQty = finiteNumber(raw.quantity);
  const rawRate = finiteNumber(raw.rate);
  const rawAmt = finiteNumber(raw.amount);

  if (rawQty !== null || rawRate !== null) {
    const quantity = rawQty ?? 1;
    const rate = rawRate ?? (rawAmt ?? 0);
    const computed = Math.round(quantity * rate);
    const amount = computed !== 0 || (quantity === 0 && rate === 0 && rawAmt === null) ? computed : (rawAmt ?? computed);
    return { quantity, description, rate, amount, legacy: false };
  }

  const amount = rawAmt ?? 0;
  return { quantity: 1, description, rate: amount, amount, legacy: true };
}

/** Parser baris potongan `{ description, amount }` (juga aman bila data lama memakai string numerik). */
export function parseDeductionLine(raw: Record<string, unknown>): DeductionLine {
  const description = String(raw.description ?? "").trim();
  const rawAmt = finiteNumber(raw.amount);
  const rawQty = finiteNumber(raw.quantity);
  const rawRate = finiteNumber(raw.rate);
  const amount = rawAmt ?? (rawQty !== null && rawRate !== null ? Math.round(rawQty * rawRate) : 0);
  return { description, amount };
}

/** True bila baris pendapatan memiliki isi yang bermakna (keterangan atau nominal non-nol). */
export function isIncomeLine(raw: Record<string, unknown> | EarningLine): boolean {
  const line = "legacy" in raw && typeof raw.amount === "number" ? (raw as EarningLine) : parseEarningLine(raw as Record<string, unknown>);
  return Boolean(line.description.trim()) || line.amount !== 0 || (line.quantity !== 0 && line.rate !== 0);
}

/** Hitung total pendapatan, total potongan, dan gaji bersih (aman untuk baris modern maupun impor lama). */
export function payslipTotals(slip: {
  earnings: (Record<string, unknown> | EarningLine)[];
  deductions: (Record<string, unknown> | DeductionLine)[];
}): { income: number; deduction: number; net: number } {
  const income = (slip.earnings ?? []).reduce((sum, raw) => {
    const line = parseEarningLine(raw as Record<string, unknown>);
    return sum + line.amount;
  }, 0);
  const deduction = (slip.deductions ?? []).reduce((sum, raw) => {
    const line = parseDeductionLine(raw as Record<string, unknown>);
    return sum + line.amount;
  }, 0);
  return { income, deduction, net: income - deduction };
}

export function normalizePayslip(
  row: typeof payslips.$inferSelect,
  meta?: { signerSignatureKey?: string | null; createdByName?: string | null },
): PayslipView {
  const earningsRaw = Array.isArray(row.earnings) ? row.earnings : [];
  const deductionsRaw = Array.isArray(row.deductions) ? row.deductions : [];
  const payKind = row.payKind === "mingguan" || row.payKind === "bulanan" ? row.payKind : null;
  return {
    id: row.id,
    employeeName: row.employeeName,
    slipDate: row.slipDate,
    payKind,
    periodFrom: row.periodFrom ?? null,
    periodTo: row.periodTo ?? null,
    earnings: earningsRaw.map((r) => parseEarningLine(r as Record<string, unknown>)).filter((r) => isIncomeLine(r)),
    deductions: deductionsRaw
      .map((r) => parseDeductionLine(r as Record<string, unknown>))
      .filter((r) => Boolean(r.description) || r.amount !== 0),
    kasbonNote: row.kasbonNote ?? null,
    note: row.note ?? null,
    signerId: row.signerId ?? null,
    signerName: row.signerName ?? null,
    signerSignatureKey: meta?.signerSignatureKey ?? null,
    createdBy: row.createdBy ?? null,
    createdByName: meta?.createdByName ?? null,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt ?? ""),
  };
}

/**
 * Rekap hasil produksi & pengecatan genteng per leader/grup dalam periode tertentu (biasanya Jumat–Kamis).
 * Mengambil dari `inv_productions` + `inv_production_lines` (role = 'hasil') + `fin_items`, serta `inv_transfers` (cat).
 */
export async function productionPay(db: DB, input: { from: string; to: string }): Promise<PayGroup[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.from) || !/^\d{4}-\d{2}-\d{2}$/.test(input.to)) return [];
  const start = new Date(`${input.from}T00:00:00+07:00`);
  const end = new Date(`${input.to}T23:59:59.999+07:00`);

  const [prodRows, paintRows] = await Promise.all([
    db
      .select({
        productionId: productions.id,
        date: productions.date,
        leader: productions.leader,
        gradeB: productions.gradeB,
        mixPart: productions.mixPart,
        qty: productionLines.qty,
        itemName: items.name,
        unit: items.unit,
      })
      .from(productionLines)
      .innerJoin(productions, eq(productionLines.productionId, productions.id))
      .innerJoin(items, eq(productionLines.itemId, items.id))
      .where(and(eq(productionLines.role, "hasil"), gte(productions.date, input.from), lte(productions.date, input.to))),
    db
      .select({
        leader: transfers.leader,
        fromKey: transfers.fromKey,
        toKey: transfers.toKey,
        qty: transfers.qty,
        movedAt: transfers.movedAt,
      })
      .from(transfers)
      .where(
        and(
          gte(transfers.movedAt, start),
          lte(transfers.movedAt, end),
          or(eq(transfers.kind, "cat"), like(sql`lower(${transfers.toKey})`, "%cat%")),
        ),
      ),
  ]);

  type ItemAcc = { description: string; quantity: number; unit: string; days: Set<string> };
  const groups = new Map<string, { leader: string; items: Map<string, ItemAcc> }>();
  const add = (leaderRaw: string | null, description: string, quantity: number, unit: string, day: string) => {
    if (!quantity) return;
    const leader = (leaderRaw ?? "").trim() || "(tanpa leader)";
    const key = leader.toUpperCase();
    const group = groups.get(key) ?? { leader, items: new Map<string, ItemAcc>() };
    const item = group.items.get(description) ?? { description, quantity: 0, unit, days: new Set<string>() };
    item.quantity += quantity;
    if (day) item.days.add(day);
    group.items.set(description, item);
    groups.set(key, group);
  };

  const seenGradeB = new Set<string>();
  for (const row of prodRows) {
    const baseName = row.itemName.replace(/\s+/g, " ").trim();
    const part = row.mixPart?.trim();
    const fullName = part && !baseName.toLowerCase().includes(part.toLowerCase()) ? `${baseName} ${part}` : baseName;
    const description = fullName.toUpperCase();
    add(row.leader, description, Number(row.qty) || 0, row.unit || "pcs", row.date);
    if (row.gradeB && !seenGradeB.has(row.productionId)) {
      seenGradeB.add(row.productionId);
      add(row.leader, `${description} (GRADE B)`, Number(row.gradeB) || 0, row.unit || "pcs", row.date);
    }
  }

  for (const row of paintRows) {
    const movedDay = row.movedAt ? toDay(row.movedAt) : "";
    const toTarget = row.toKey.includes("|")
      ? row.toKey.split("|").slice(1).join(" ")
      : row.toKey.trim().toLowerCase() === "cat"
        ? (row.fromKey.split("|")[1] ?? row.fromKey)
        : row.toKey;
    const label = toTarget.replace(/·/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
    const description = label && label !== "CAT" ? `CAT GENTENG ${label}` : "CAT GENTENG";
    add(row.leader, description, Number(row.qty) || 0, "pcs", movedDay);
  }

  return [...groups.values()]
    .map((group) => ({
      leader: group.leader,
      items: [...group.items.values()]
        .map((item) => ({
          description: item.description,
          quantity: Math.round(item.quantity * 100) / 100,
          unit: item.unit,
          days: item.days.size,
        }))
        .sort((a, b) => a.description.localeCompare(b.description, "id")),
    }))
    .sort((a, b) => a.leader.localeCompare(b.leader, "id"));
}

export type WeeklyItemRecap = {
  payday: string;
  from: string;
  to: string;
  groups: PayGroup[];
  totalGroups: number;
  totalItems: number;
  totalQty: number;
  sheets: SheetData[];
};

/** Susun ringkasan rekap barang gajian Kamis (Jumat–Kamis) beserta data SheetJS untuk ekspor Excel. */
export function buildWeeklyItemRecap(groups: PayGroup[], meta: { from: string; to: string; payday: string }): WeeklyItemRecap {
  const totalItems = groups.reduce((s, g) => s + g.items.length, 0);
  const totalQty = groups.reduce((s, g) => s + g.items.reduce((a, i) => a + i.quantity, 0), 0);
  const rows: Record<string, unknown>[] = [];
  for (const g of groups) {
    g.items.forEach((item, idx) => {
      rows.push({
        leader: g.leader,
        no: idx + 1,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        days: item.days,
      });
    });
  }
  const sheets: SheetData[] = [
    {
      name: "Rekap Barang",
      title: `REKAP BARANG GAJIAN ${meta.payday} (${meta.from} s/d ${meta.to})`,
      columns: [
        { key: "leader", header: "Leader / Grup", width: 22 },
        { key: "no", header: "No", width: 6 },
        { key: "description", header: "Barang", width: 38 },
        { key: "quantity", header: "Jumlah", width: 12 },
        { key: "unit", header: "Satuan", width: 10 },
        { key: "days", header: "Hari", width: 8 },
      ],
      rows,
    },
  ];
  return {
    payday: meta.payday,
    from: meta.from,
    to: meta.to,
    groups,
    totalGroups: groups.length,
    totalItems,
    totalQty: Math.round(totalQty * 100) / 100,
    sheets,
  };
}

export async function getPayslipsWithMeta(
  db: DB,
  filters?: { from?: string; to?: string; search?: string; month?: string },
): Promise<PayslipView[]> {
  const conds = [];
  const from = filters?.from?.trim();
  const to = filters?.to?.trim();
  const month = filters?.month?.trim();
  const search = filters?.search?.trim();

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    conds.push(like(payslips.slipDate, `${month}%`));
  } else {
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) conds.push(gte(payslips.slipDate, from));
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) conds.push(lte(payslips.slipDate, to));
  }
  if (search) {
    conds.push(like(sql`lower(${payslips.employeeName})`, `%${search.toLowerCase()}%`));
  }

  const [rows, userRows] = await Promise.all([
    db
      .select()
      .from(payslips)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(payslips.slipDate), desc(payslips.updatedAt)),
    db.select({ id: users.id, name: users.name, signatureKey: users.signatureKey }).from(users),
  ]);

  const userMap = new Map(userRows.map((u) => [u.id, u]));
  return rows.map((row) => {
    const signer = row.signerId ? userMap.get(row.signerId) : undefined;
    const creator = row.createdBy ? userMap.get(row.createdBy) : undefined;
    return normalizePayslip(row, {
      signerSignatureKey: signer?.signatureKey ?? null,
      createdByName: creator?.name ?? null,
    });
  });
}

export async function getPayslipByIdWithMeta(db: DB, id: string): Promise<PayslipView | null> {
  const [row] = await db.select().from(payslips).where(eq(payslips.id, id)).limit(1);
  if (!row) return null;
  const userRows = await db.select({ id: users.id, name: users.name, signatureKey: users.signatureKey }).from(users);
  const userMap = new Map(userRows.map((u) => [u.id, u]));
  const signer = row.signerId ? userMap.get(row.signerId) : undefined;
  const creator = row.createdBy ? userMap.get(row.createdBy) : undefined;
  return normalizePayslip(row, {
    signerSignatureKey: signer?.signatureKey ?? null,
    createdByName: creator?.name ?? null,
  });
}

export async function getPayslipSigners(db: DB): Promise<SignerOption[]> {
  const rows = await db
    .select({ id: users.id, name: users.name, signatureKey: users.signatureKey })
    .from(users);
  return rows
    .map((u) => ({ id: u.id, name: u.name, signatureKey: u.signatureKey ?? null }))
    .sort((a, b) => Number(Boolean(b.signatureKey)) - Number(Boolean(a.signatureKey)) || a.name.localeCompare(b.name, "id"));
}

export async function getKasbonBalances(db: DB): Promise<KasbonBalance[]> {
  const rows = await db.select().from(kasbonEntries);
  const map = new Map<string, { name: string; kasbon: number; bayar: number }>();
  for (const row of rows) {
    const key = row.employeeName.trim().toUpperCase();
    const cur = map.get(key) ?? { name: row.employeeName.trim(), kasbon: 0, bayar: 0 };
    if (row.kind === "kasbon") cur.kasbon += row.amount;
    else cur.bayar += row.amount;
    map.set(key, cur);
  }
  return [...map.values()]
    .map((v) => ({ ...v, sisa: v.kasbon - v.bayar }))
    .sort((a, b) => b.sisa - a.sisa || a.name.localeCompare(b.name, "id"));
}

/** Format rupiah untuk tampilan dan cetak A5. */
export const formatRupiahSimple = (value: number) => Math.round(value).toLocaleString("id-ID");

/** Format angka kuantitas untuk tampilan dan cetak A5. */
export const formatSlipQty = (value: number) => value.toLocaleString("id-ID", { maximumFractionDigits: 2 });

/** Tanggal huruf kapital lengkap untuk header slip gaji A5. */
export function longSlipDate(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return day.toUpperCase();
  return new Date(`${day}T12:00:00+07:00`)
    .toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })
    .toUpperCase();
}

export const PAYSLIP_A5_STYLE = `
@page { size: A5 portrait; margin: 10mm; }
.ps-sheet-list { display: flex; flex-direction: column; gap: 18px; align-items: center; }
.ps-sheet {
  --doc: #2f5fae;
  width: 100%;
  max-width: 148mm;
  background: #fff;
  color: #111;
  padding: 10mm;
  box-shadow: 0 8px 30px rgba(14, 42, 107, .12);
  font-size: 9pt;
  line-height: 1.35;
}
.ps-sheet.is-copy { --doc: #4a4a4a; }
.ps-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; border-bottom: 2px solid var(--doc); padding-bottom: 6px; }
.ps-brand { display: flex; align-items: center; gap: 8px; }
.ps-brand img { width: 38px; height: 38px; object-fit: contain; }
.ps-brand h2 { margin: 0; font-size: 11pt; color: var(--doc); letter-spacing: .02em; }
.ps-brand p { margin: 2px 0 0; font-size: 7pt; color: #444; }
.ps-title { border: 1.5px solid var(--doc); color: var(--doc); font-size: 11pt; font-weight: 700; letter-spacing: .06em; padding: 3px 10px; white-space: nowrap; }
table.ps-meta { width: 100%; margin: 6px 0 4px; font-size: 8.5pt; border-collapse: collapse; }
table.ps-meta td { padding: 1px 0; }
table.ps-meta td.r { text-align: right; }
table.ps { width: 100%; border-collapse: collapse; font-size: 8pt; }
table.ps th { background: var(--doc); color: #fff; font-weight: 700; padding: 3px 4px; border: 1px solid var(--doc); }
table.ps td { border: 1px solid var(--doc); padding: 2px 4px; height: 15px; }
table.ps tbody td { border-top: none; border-bottom: none; }
table.ps tbody tr:last-child td:not(.gap) { border-bottom: 1px solid var(--doc); }
table.ps th.gap, table.ps td.gap { background: none !important; border: none !important; width: 7px; padding: 0; }
table.ps tfoot td:not(.gap) { border: 1px solid var(--doc); background: #eef3fb; font-weight: 700; }
.ps-sheet.is-copy table.ps tfoot td:not(.gap) { background: #eeeeee; }
table.ps .c { text-align: center; }
table.ps .r { text-align: right; font-variant-numeric: tabular-nums; }
.ps-foot { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px; }
.ps-signs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; text-align: center; font-size: 8pt; }
.ps-sign-box { display: flex; flex-direction: column; justify-content: space-between; min-height: 68px; }
.ps-sign-box img { max-height: 38px; width: auto; margin: 2px auto; object-fit: contain; }
.ps-sign-name { border-top: 1px solid #222; padding-top: 2px; font-weight: 700; }
.ps-kasbon { border: 1px solid var(--doc); padding: 4px 6px; font-size: 7.5pt; min-height: 28px; white-space: pre-line; }
table.ps-total { width: 100%; border-collapse: collapse; margin-top: 4px; }
table.ps-total td { border: 1.5px solid var(--doc); padding: 4px 6px; font-size: 9.5pt; font-weight: 700; color: var(--doc); }
table.ps-total td.r { text-align: right; font-variant-numeric: tabular-nums; }
.ps-note { font-size: 7.5pt; margin: 4px 0 0; color: #333; white-space: pre-line; }
@media print {
  .ps-sheet-list { display: block; }
  .ps-sheet { max-width: none; padding: 0; box-shadow: none; }
  .ps-sheet.page-break { page-break-before: always; break-before: page; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
@media (max-width: 600px) {
  .ps-sheet { padding: 12px; }
  .ps-foot { grid-template-columns: 1fr; }
}
`;

export const REKAP_A5_STYLE = `
@page { size: A5 portrait; margin: 10mm; }
.rk-sheet {
  width: 100%;
  max-width: 148mm;
  margin: 0 auto;
  background: #fff;
  color: #111;
  padding: 10mm;
  box-shadow: 0 8px 30px rgba(14, 42, 107, .12);
  font-size: 9pt;
  line-height: 1.35;
}
.rk-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; border-bottom: 2px solid #0e2a6b; padding-bottom: 6px; margin-bottom: 8px; }
.rk-brand { display: flex; align-items: center; gap: 8px; }
.rk-brand img { height: 34px; width: auto; object-fit: contain; }
.rk-brand b { display: block; font-size: 11pt; color: #0e2a6b; }
.rk-brand span { display: block; font-size: 7pt; color: #444; }
.rk-title { text-align: center; margin: 6px 0 2px; font-size: 12pt; font-weight: 700; color: #0e2a6b; }
.rk-meta { text-align: center; margin: 0 0 10px; font-size: 8.5pt; color: #333; }
table.rk-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 10px; page-break-inside: avoid; break-inside: avoid; }
table.rk-table th, table.rk-table td { border: 1px solid #334155; padding: 3px 5px; }
table.rk-table thead tr:first-child th { background: #0e2a6b; color: #fff; text-align: left; font-size: 9.5pt; }
table.rk-table thead tr:nth-child(2) th { background: #eef3fb; color: #0e2a6b; font-size: 8pt; }
table.rk-table .c { text-align: center; }
table.rk-table .r { text-align: right; font-variant-numeric: tabular-nums; }
@media print {
  .rk-sheet { max-width: none; padding: 0; box-shadow: none; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
@media (max-width: 600px) {
  .rk-sheet { padding: 12px; }
}
`;

const escHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function renderSlipSheetHtml(slip: PayslipView, label: "Utama" | "Copy", site: Settings, pageBreak: boolean): string {
  const t = payslipTotals(slip);
  const rows = Math.max(6, slip.earnings.length, slip.deductions.length);
  const company = escHtml((site.legal_name || site.company_name || "ISTANA BLOCK PURWAKARTA").toUpperCase());
  const phones = [site.phone_office, site.phone || site.whatsapp].filter(Boolean).join(" · ");
  const periodInfo =
    slip.periodFrom && slip.periodTo
      ? `<tr><td colspan="2">Periode : <b>${longSlipDate(slip.periodFrom)} s/d ${longSlipDate(slip.periodTo)}</b>${
          slip.payKind === "mingguan"
            ? " (gajian Kamis · Jumat–Kamis)"
            : slip.payKind === "bulanan"
              ? " (gajian bulanan tgl 1)"
              : ""
        }</td></tr>`
      : "";

  const bodyRows = Array.from({ length: rows }, (_, i) => {
    const e = slip.earnings[i];
    const d = slip.deductions[i];
    const earningCells = e
      ? `<td class="c">${e.legacy ? "1" : formatSlipQty(e.quantity)}</td><td>${escHtml(e.description)}</td><td class="r">${formatRupiahSimple(e.legacy ? e.amount : e.rate)}</td><td class="r">${formatRupiahSimple(e.amount)}</td>`
      : "<td></td><td></td><td></td><td></td>";
    const deductionCells = d
      ? `<td class="c">${i + 1}</td><td>${escHtml(d.description)}</td><td class="r">${formatRupiahSimple(d.amount)}</td>`
      : "<td></td><td></td><td></td>";
    return `<tr>${earningCells}<td class="gap"></td>${deductionCells}</tr>`;
  }).join("");

  const makerHtml = slip.signerName
    ? `${
        slip.signerSignatureKey
          ? `<img src="/operasional/berkas/${escHtml(slip.signerSignatureKey)}" alt="TTD ${escHtml(slip.signerName)}" />`
          : "<div style=\"height:36px\"></div>"
      }<span class="ps-sign-name">${escHtml(slip.signerName.toUpperCase())}</span>`
    : `<div style="height:36px"></div><span class="ps-sign-name">${escHtml((slip.createdByName ?? "").toUpperCase() || "ADMIN")}</span>`;

  return `<section class="ps-sheet${label === "Copy" ? " is-copy" : ""}${pageBreak ? " page-break" : ""}">
  <div class="ps-head">
    <div class="ps-brand">
      <img src="/brand/logo-istana-block.webp" alt="" />
      <div>
        <h2>${company}</h2>
        ${site.address ? `<p>${escHtml(site.address)}</p>` : ""}
        ${phones ? `<p>Telp. ${escHtml(phones)}</p>` : ""}
      </div>
    </div>
    <div class="ps-title">SLIP GAJI : ${label}</div>
  </div>
  <table class="ps-meta">
    <tr><td>Nama : <b>${escHtml(slip.employeeName.toUpperCase())}</b></td><td class="r">Tanggal : <b>${longSlipDate(slip.slipDate)}</b></td></tr>
    ${periodInfo}
  </table>
  <table class="ps">
    <thead>
      <tr><th colspan="4">Pendapatan</th><th class="gap"></th><th colspan="3">Potongan</th></tr>
      <tr><th style="width:46px">Banyak</th><th>Barang / Keterangan</th><th style="width:66px">Satuan</th><th style="width:78px">Jumlah</th><th class="gap"></th><th style="width:24px">No</th><th>Keterangan</th><th style="width:74px">Jumlah</th></tr>
    </thead>
    <tbody>${bodyRows}</tbody>
    <tfoot>
      <tr><td colspan="3" class="r">Jumlah :</td><td class="r">${formatRupiahSimple(t.income)}</td><td class="gap"></td><td colspan="2" class="r">Jumlah :</td><td class="r">${formatRupiahSimple(t.deduction)}</td></tr>
    </tfoot>
  </table>
  <div class="ps-foot">
    <div class="ps-signs">
      <div class="ps-sign-box"><span>Penerima</span><div style="height:36px"></div><span class="ps-sign-name">${escHtml(slip.employeeName.toUpperCase())}</span></div>
      <div class="ps-sign-box"><span>Pembuat</span>${makerHtml}</div>
    </div>
    <div>
      <div class="ps-kasbon"><b>Sisa Kasbon :</b><br/>${escHtml(slip.kasbonNote || "-")}</div>
      <table class="ps-total"><tr><td>Total Diterima :</td><td class="r">Rp ${formatRupiahSimple(t.net)}</td></tr></table>
      ${slip.note ? `<p class="ps-note">${escHtml(slip.note)}</p>` : ""}
    </div>
  </div>
</section>`;
}

/** Susun HTML halaman A5 (Utama biru & Copy abu tua) untuk satu atau banyak slip gaji. */
export function buildPayslipA5Html(slips: PayslipView[], site: Settings): string {
  return slips
    .flatMap((slip) => (["Utama", "Copy"] as const).map((label) => ({ slip, label })))
    .map(({ slip, label }, index) => renderSlipSheetHtml(slip, label, site, index > 0))
    .join("");
}

