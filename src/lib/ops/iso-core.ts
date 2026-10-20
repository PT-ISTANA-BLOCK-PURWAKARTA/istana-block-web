// Inti Rekap ISO (form F-IB-01 s/d 16): kueri BACA baris form dari data aplikasi + isian langsung, ringkasan periode,
// Sasaran Mutu, saran pengisian, dan deteksi jadwal jatuh tempo. Dipakai halaman /operasional/rekap-iso DAN cron.
// TANPA "server-only" dan TANPA alias "@/" (ikut dibundel worker.ts untuk handler scheduled): impor relatif saja,
// semua fungsi menerima `db` (drizzle D1 dengan skema) sebagai argumen.
import { and, asc, count, eq, gte, inArray, like, lt, lte, notInArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { MaterialLine, OrderStatus } from "../../db/erp";
import * as schema from "../../db/schema";
import { can, type Role } from "../roles";
import { fmt } from "./shared/format";
import { productionLine } from "./shared/goods";
import { addDays, computeIsoValues, daysBetween, FORM_BY_CODE, isDay, ISO_CODES, KGCM2_PER_MPA, num, productClass, workingDaysBetween, type IsoCode, type IsoForm, type IsoInputRole, type IsoValues } from "./shared/isoForms";
import { QUALITY_OBJECTIVES, type ObjectiveAuto } from "./shared/isoObjectives";
import type { DayRange, IsoOverview } from "./shared/isoRecap";
import { wibDate } from "./shared/period";
import { PRICE_LABELS, TIER_LABELS, type SandTier } from "./shared/sand";
import { evaluateSample } from "./shared/strength";
import type { OpsDb } from "./push";

export type { DayRange };

/** Kesalahan validasi yang aman ditampilkan; iso.ts mengubahnya menjadi UserError. */
export class IsoError extends Error {}
function fail(message: string): never {
  throw new IsoError(message);
}

export type IsoRow = {
  /** Kunci baris: "rec:<id>" (isian langsung) atau "<jenis>:<id>" (dari data aplikasi). */
  key: string;
  source: "app" | "manual";
  recordId: string | null;
  number: string | null;
  values: IsoValues;
  createdBy: number | null;
  createdByName: string | null;
  history?: { at: string; by: string; values: IsoValues }[];
};

const WIB_MS = 7 * 3600_000;
const instant = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - WIB_MS);
const bounds = (range: DayRange) => ({ start: instant(range.from), end: instant(addDays(range.to, 1)) });
export const todayWib = () => wibDate(new Date());

/** Baris dari aplikasi ditampilkan 300 per halaman (batas CPU Workers Free). */
export const PAGE_SIZE = 300;
/** Daftar id untuk IN (...) dipecah supaya satu perintah D1 tidak melewati ±100 parameter. */
const CHUNK = 80;
/** Rentang rekap maksimal 3 tahun. */
export const MAX_RANGE_DAYS = 366 * 3;

async function inChunks<T, K>(values: K[], run: (part: K[]) => Promise<T[]>) {
  const out: T[] = [];
  for (let i = 0; i < values.length; i += CHUNK) out.push(...(await run(values.slice(i, i + CHUNK))));
  return out;
}

const joinText = (parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ") || null;
const round1 = (value: number | null) => (value === null ? null : Math.round(value * 10) / 10);
const average = (values: (number | null)[]) => {
  const list = values.filter((v): v is number => v !== null);
  return list.length ? list.reduce((sum, v) => sum + v, 0) / list.length : null;
};
const asDay = (value: unknown): string | null => (isDay(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? value : null);

// ---------------------------------------------------------------------------
// Rentang tanggal
// ---------------------------------------------------------------------------

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Pintasan rentang (bulan ini/lalu, 3 bulan, tahun ini). */
export function isoPresets(today: string) {
  const [year, month] = today.split("-").map(Number);
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthsBack = (n: number) => {
    const d = new Date(Date.UTC(year, month - 1 - n, 1));
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-01`;
  };
  return [
    { key: "bulan", label: "Bulan ini", range: { from: monthStart, to: today } },
    { key: "lalu", label: "Bulan lalu", range: { from: monthsBack(1), to: addDays(monthStart, -1) } },
    { key: "3bulan", label: "3 bulan", range: { from: monthsBack(2), to: today } },
    { key: "tahun", label: "Tahun ini", range: { from: `${year}-01-01`, to: today } },
  ];
}

/** Baca ?dari=&sampai=; bila kosong/tidak valid kembali ke bulan ini (dengan pesan bila tidak valid). */
export function parseRange(dari: unknown, sampai: unknown, today: string): { range: DayRange; error?: string } {
  const fallback = { from: `${today.slice(0, 7)}-01`, to: today };
  if (dari == null && sampai == null) return { range: fallback };
  const from = asDay(dari), to = asDay(sampai);
  if (!from || !to) return { range: fallback, error: "Tanggal tidak valid; menampilkan bulan ini." };
  if (from > to) return { range: fallback, error: "Tanggal awal harus sebelum tanggal akhir; menampilkan bulan ini." };
  if (daysBetween(from, to) > MAX_RANGE_DAYS) return { range: fallback, error: "Rentang maksimal 3 tahun; menampilkan bulan ini." };
  return { range: { from, to } };
}

// ---------------------------------------------------------------------------
// Hak akses (murni, dari peran)
// ---------------------------------------------------------------------------

const isOfficeRole = (roles: readonly Role[]) => roles.includes("owner") || roles.includes("operasional");
/** Data pelanggan (nama, alamat, HP) hanya untuk kantor & pimpinan (pemegang izin laporan). */
export const canViewCustomers = (roles: readonly Role[]) => isOfficeRole(roles) || can(roles, "laporan");
export const canViewForm = (roles: readonly Role[], code: IsoCode) => can(roles, "iso") && (code !== "F-IB-01" || canViewCustomers(roles));

/** Peran web -> peran pada daftar `inputRoles` form (manajer QC setara QC). */
function inputRolesOf(roles: readonly Role[]) {
  const out = new Set<IsoInputRole>();
  for (const r of roles) {
    if (r === "owner" || r === "operasional" || r === "qc" || r === "mandor" || r === "satpam" || r === "pimpinan") out.add(r);
    if (r === "manajer_qc") out.add("qc");
  }
  return out;
}
export const canInputForm = (roles: readonly Role[], form: IsoForm) => {
  const mine = inputRolesOf(roles);
  return can(roles, "iso") && form.inputRoles.some((r) => mine.has(r));
};
export const canSetObjective = (roles: readonly Role[]) => can(roles, "iso") && (isOfficeRole(roles) || roles.includes("qc") || roles.includes("manajer_qc"));
export const canDeleteAny = isOfficeRole;

// ---------------------------------------------------------------------------
// Isian langsung (kind = record) & pelengkap (kind = supplement)
// ---------------------------------------------------------------------------

type IsoRecordRow = typeof schema.isoRecords.$inferSelect;
const ir = schema.isoRecords;

export async function manualRecords(db: OpsDb, codes: IsoCode[], range: DayRange | null) {
  if (!codes.length) return [];
  const where = [inArray(ir.formCode, codes), eq(ir.kind, "record")];
  if (range) where.push(gte(ir.recordDate, range.from), lte(ir.recordDate, range.to));
  return db.select().from(ir).where(and(...where)).orderBy(asc(ir.recordDate), asc(ir.createdAt));
}

export const manualRow = (record: IsoRecordRow, day: string): IsoRow => ({
  key: `rec:${record.id}`,
  source: "manual",
  recordId: record.id,
  number: record.number,
  values: computeIsoValues(FORM_BY_CODE[record.formCode as IsoCode], record.data, day),
  createdBy: record.createdBy,
  createdByName: record.createdByName,
  history: record.history.length ? record.history : undefined,
});

/** Satu baris isian langsung (untuk ubah). */
export async function getManualRecord(db: OpsDb, code: IsoCode, id: string) {
  const [row] = await db.select().from(ir).where(and(eq(ir.id, id), eq(ir.formCode, code), eq(ir.kind, "record"))).limit(1);
  return row ?? null;
}

async function supplementsFor(db: OpsDb, code: IsoCode, keys: string[]) {
  const rows = await inChunks(keys, (part) =>
    db.select({ sourceKey: ir.sourceKey, data: ir.data }).from(ir).where(and(eq(ir.formCode, code), eq(ir.kind, "supplement"), inArray(ir.sourceKey, part))),
  );
  return new Map(rows.map((r) => [r.sourceKey ?? "", r.data]));
}

const appRow = (form: IsoForm, key: string, values: IsoValues, day: string): IsoRow => ({
  key,
  source: "app",
  recordId: null,
  number: null,
  values: computeIsoValues(form, values, day, [], true),
  createdBy: null,
  createdByName: null,
});

type Page = { limit: number; offset: number };
type AppPage = { rows: IsoRow[]; hasMore: boolean };

// ---------------------------------------------------------------------------
// Baris dari data aplikasi
// ---------------------------------------------------------------------------

const NOT_ORDERS: OrderStatus[] = ["batal", "draft"];

/** Status bayar PO (dibaca dari Zahir) -> pilihan form: tempo = Tempo, lunas/belum lunas (cash/COD) = Cash. */
const payChoice = (status: string | null) => (status === "tempo" ? "Tempo" : status === "lunas" || status === "belum_lunas" ? "Cash" : null);

/** F-IB-01: satu baris per PO (bukan draf/batal). */
async function customerRows(db: OpsDb, range: DayRange, page: Page): Promise<AppPage> {
  const o = schema.orders, c = schema.contacts;
  const list = await db
    .select({
      id: o.id, number: o.number, date: o.date, note: o.note, project: o.project, address: o.address, siteContact: o.siteContact,
      contactId: o.contactId, paymentStatus: o.paymentStatus, name: c.name, company: c.company, phone: c.phone,
    })
    .from(o)
    .innerJoin(c, eq(o.contactId, c.id))
    .where(and(gte(o.date, range.from), lte(o.date, range.to), notInArray(o.status, NOT_ORDERS)))
    .orderBy(asc(o.date), asc(o.number))
    .limit(page.limit + 1)
    .offset(page.offset);
  const rows = list.slice(0, page.limit);
  const orderIds = rows.map((r) => r.id);
  const contactIds = [...new Set(rows.map((r) => r.contactId))];
  const [lines, firsts, extra] = await Promise.all([
    inChunks(orderIds, (part) =>
      db.select({ orderId: schema.orderLines.orderId, description: schema.orderLines.description, name: schema.items.name, sort: schema.orderLines.sort })
        .from(schema.orderLines).leftJoin(schema.items, eq(schema.items.id, schema.orderLines.itemId))
        .where(inArray(schema.orderLines.orderId, part)).orderBy(asc(schema.orderLines.sort)),
    ),
    inChunks(contactIds, (part) =>
      db.select({ contactId: o.contactId, first: sql<string>`min(${o.date})` }).from(o).where(and(inArray(o.contactId, part), notInArray(o.status, NOT_ORDERS))).groupBy(o.contactId),
    ),
    supplementsFor(db, "F-IB-01", [...orderIds.map((id) => `order:${id}`), ...contactIds.map((id) => `customer:${id}`)]),
  ]);
  const firstOrder = new Map(firsts.map((r) => [r.contactId, r.first]));
  const form = FORM_BY_CODE["F-IB-01"], day = todayWib();
  return {
    hasMore: list.length > page.limit,
    rows: rows.map((row) => {
      const customer = extra.get(`customer:${row.contactId}`) ?? {}, order = extra.get(`order:${row.id}`) ?? {};
      const repeat = row.date > (firstOrder.get(row.contactId) ?? row.date);
      const produk = lines
        .filter((l) => l.orderId === row.id)
        .map((l) => {
          const desc = l.description.trim(), name = l.name ?? "";
          return desc && name && !desc.toLowerCase().includes(name.toLowerCase()) ? `${name} ${desc}` : desc || name;
        })
        .filter(Boolean)
        .join(", ");
      return appRow(form, `order:${row.id}`, {
        tanggal: row.date,
        tipe: customer.tipe ?? null,
        nama: row.company || row.name,
        proyek: order.proyek ?? (row.project || null),
        alamat: row.address || null,
        produk: produk || null,
        bayar: customer.bayar ?? payChoice(row.paymentStatus),
        pic: row.siteContact || row.name,
        hp: row.phone || null,
        keterangan: order.keterangan ?? joinText([`PO ${row.number}`, repeat ? "Repeat order" : "Pelanggan baru", row.note]),
      }, day);
    }),
  };
}

const COUNTED_UNITS = new Set(["buah", "pcs", "unit"]);

type ProductionSqlRow = {
  id: string; date: string; category: string | null; batchCode: string | null; leader: string | null; target: number | null; cementBags: number | null;
  rejects: number | null; issues: string | null; note: string; qty: number | null; product: string | null; unit: string | null; creator: string | null; rn: number;
};

const parseIssues = (text: string | null): string[] => {
  try {
    const parsed = JSON.parse(text ?? "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

/**
 * F-IB-02: satu baris per baris hasil produksi (inv_production_lines role hasil). Kolom tingkat dokumen
 * (target, reject, semen, kendala, catatan) hanya dicantumkan di baris pertama dokumen agar tidak terhitung ganda.
 */
async function productionRows(db: OpsDb, range: DayRange, page: Page): Promise<AppPage> {
  const list = await db.all<ProductionSqlRow>(sql`
    select p.id as id, p.date as date, p.category as category, p.batch_code as batchCode, p.leader as leader, p.target as target,
      p.cement_bags as cementBags, p.rejects as rejects, p.issues as issues, p.note as note,
      l.qty as qty, i.name as product, i.unit as unit, u.name as creator,
      row_number() over (partition by p.id order by l.rowid) as rn
    from inv_productions p
    left join inv_production_lines l on l.production_id = p.id and l.role = 'hasil'
    left join fin_items i on i.id = l.item_id
    left join users u on u.id = p.created_by
    where p.date >= ${range.from} and p.date <= ${range.to}
    order by p.date, p.number, l.rowid
    limit ${page.limit + 1} offset ${page.offset}`);
  const form = FORM_BY_CODE["F-IB-02"], day = todayWib();
  return {
    hasMore: list.length > page.limit,
    rows: list.slice(0, page.limit).map((row) => {
      const first = Number(row.rn) === 1;
      const product = row.product ?? "";
      const category = row.category === "paving" || row.category === "precast" ? row.category : productClass(product) === "paving" ? "paving" : "precast";
      const issues = first ? parseIssues(row.issues) : [];
      return appRow(form, `production:${row.id}:${row.rn}`, {
        tanggal: row.date,
        leader: row.leader || row.creator,
        lini: productionLine(category, product),
        produk: product || null,
        batch: row.batchCode,
        target: first ? row.target : null,
        realisasi: row.qty,
        reject: first ? row.rejects : null,
        semen: first ? row.cementBags : null,
        catatan: joinText([
          issues.length ? `Kendala: ${issues.join(", ")}` : null,
          first ? row.note || null : null,
          row.unit && !COUNTED_UNITS.has(row.unit.toLowerCase()) ? `Satuan: ${row.unit}` : null,
        ]),
      }, day);
    }),
  };
}

const materialsText = (lines: MaterialLine[]) =>
  lines.filter((l) => l.name).map((l) => (l.qty === null ? l.name : `${l.name} ${fmt(l.qty, 2)} ${l.unit}`.trim())).join(", ") || null;
const CHECK_LABELS = { sesuai: "Sesuai", tidak_sesuai: "Tidak Sesuai", perlu_perbaikan: "Perlu Perbaikan" } as const;
const creatorUser = alias(schema.users, "isoCreator");
const reviewerUser = alias(schema.users, "isoReviewer");
const labUser = alias(schema.users, "isoLab");
const qualityUser = alias(schema.users, "isoQuality");
const completerUser = alias(schema.users, "isoCompleter");

/** F-IB-03: catatan mix desain harian QC; kode batch dari produksi paving di tanggal yang sama. */
async function mixRows(db: OpsDb, range: DayRange, page: Page): Promise<AppPage> {
  const ml = schema.mixLogs;
  const [list, batches] = await Promise.all([
    db
      .select({
        id: ml.id, date: ml.workDate, layer: ml.layer, product: ml.product, approved: ml.approvedMaterials, actual: ml.actualMaterials,
        mixingCount: ml.mixingCount, status: ml.status, notes: ml.notes, reviewStatus: ml.reviewStatus, creator: creatorUser.name, reviewer: reviewerUser.name,
      })
      .from(ml)
      .leftJoin(creatorUser, eq(ml.createdBy, creatorUser.id))
      .leftJoin(reviewerUser, eq(ml.managerSignedBy, reviewerUser.id))
      .where(and(gte(ml.workDate, range.from), lte(ml.workDate, range.to)))
      .orderBy(asc(ml.workDate), asc(ml.createdAt))
      .limit(page.limit + 1)
      .offset(page.offset),
    db.all<{ date: string; batchCode: string; names: string | null }>(sql`
      select p.date as date, p.batch_code as batchCode, group_concat(i.name, '||') as names
      from inv_productions p
      left join inv_production_lines l on l.production_id = p.id and l.role = 'hasil'
      left join fin_items i on i.id = l.item_id
      where p.category = 'paving' and p.batch_code is not null and p.date >= ${range.from} and p.date <= ${range.to}
      group by p.id`),
  ]);
  const rows = list.slice(0, page.limit);
  const extra = await supplementsFor(db, "F-IB-03", rows.map((r) => `mix:${r.id}`));
  const matchBatch = (day: string, product: string) => {
    const candidates = batches.filter((b) => b.date === day);
    const name = product.toLowerCase();
    const matched = candidates.filter((b) => (b.names ?? "").split("||").some((n) => { const x = n.toLowerCase().trim(); return x !== "" && (x.includes(name) || name.includes(x)); }));
    return (matched.length ? matched : candidates.length === 1 ? candidates : []).map((b) => b.batchCode).join(", ") || null;
  };
  const form = FORM_BY_CODE["F-IB-03"], day = todayWib();
  return {
    hasMore: list.length > page.limit,
    rows: rows.map((row) => {
      const supplement = extra.get(`mix:${row.id}`) ?? {};
      return appRow(form, `mix:${row.id}`, {
        tanggal: row.date,
        item: `${row.product} (${row.layer === "lainnya" ? "lainnya" : `lapisan ${row.layer}`})`,
        batch: supplement.batch ?? matchBatch(row.date, row.product),
        disetujui: materialsText(row.approved),
        hasil: joinText([materialsText(row.actual), row.mixingCount ? `${fmt(row.mixingCount, 2)}× adukan` : null]),
        status: CHECK_LABELS[row.status],
        catatan: joinText([row.notes, row.reviewStatus === "disetujui" ? `ACC ${row.reviewer ?? ""}`.trim() : row.reviewStatus === "revisi" ? "Diminta revisi" : "Menunggu ACC"]),
        paraf: row.creator,
      }, day);
    }),
  };
}

/** F-IB-04: benda uji kuat tekan internal (tanggal uji = tanggal tes benda uji, atau tanggal laporan). */
async function strengthRows(db: OpsDb, range: DayRange, page: Page, withSupplements = true): Promise<AppPage> {
  const ss = schema.strengthSamples, st = schema.strengthTests;
  const testedAt = sql`coalesce(${ss.testedAt}, ${st.reportDate})`;
  const list = await db
    .select({
      id: ss.id, name: ss.sampleName, madeAt: ss.madeAt, testedAt: ss.testedAt, areaCm2: ss.areaCm2, maxLoadKn: ss.maxLoadKn,
      reportDate: st.reportDate, grade: st.concreteGrade, notes: st.notes, creator: creatorUser.name, lab: labUser.name,
    })
    .from(ss)
    .innerJoin(st, eq(ss.testId, st.id))
    .leftJoin(creatorUser, eq(st.createdBy, creatorUser.id))
    .leftJoin(labUser, eq(st.labSignedBy, labUser.id))
    .where(sql`${testedAt} >= ${range.from} and ${testedAt} <= ${range.to}`)
    .orderBy(asc(testedAt), asc(ss.position), asc(ss.id))
    .limit(page.limit + 1)
    .offset(page.offset);
  const rows = list.slice(0, page.limit);
  const extra = withSupplements ? await supplementsFor(db, "F-IB-04", rows.map((r) => `sample:${r.id}`)) : new Map<string, IsoValues>();
  const form = FORM_BY_CODE["F-IB-04"], day = todayWib();
  return {
    hasMore: list.length > page.limit,
    rows: rows.map((row) => {
      const result = evaluateSample(row.grade, row), supplement = extra.get(`sample:${row.id}`) ?? {};
      return appRow(form, `sample:${row.id}`, {
        tanggalUji: row.testedAt ?? row.reportDate,
        produk: row.name,
        batch: supplement.batch ?? null,
        tanggalProduksi: row.madeAt,
        jenisUji: "Kuat Tekan",
        mutu: row.grade,
        beratKering: null,
        beratBasah: null,
        beban: row.maxLoadKn,
        luas: row.areaCm2,
        kgcm2: result.strength,
        batas: result.target === null ? null : result.target / KGCM2_PER_MPA,
        statusUji: result.passed === null ? null : result.passed ? "LULUS" : "TIDAK LULUS",
        lab: supplement.lab ?? "Internal",
        catatan: joinText([result.target === null ? null : `Target umur ${result.ageDays} hari ${fmt(result.target, 2)} kg/cm² (${row.grade})`, row.notes]),
        paraf: row.lab ?? row.creator,
      }, day);
    }),
  };
}

/** Skala 1-5 dari penilaian barang masuk: tier 1 Bagus = 5 ... tier 4 = 1; Cepat = 5, Standard = 3, Lambat = 1. */
const tierScore = (tier: number | null) => (tier ? 5 - ((tier - 1) * 4) / 3 : null);
const levelScore = (rating: number | null) => (rating ? 1 + (rating - 1) * 2 : null);

/** F-IB-08: satu baris per supplier & ekspedisi pada periode, dari penilaian barang masuk. */
async function vendorRows(db: OpsDb, range: DayRange): Promise<IsoRow[]> {
  const { start, end } = bounds(range);
  const g = schema.goodsReceipts;
  const list = await db
    .select({
      receivedAt: g.receivedAt, supplier: g.supplier, expedition: g.expeditionName, mode: g.deliveryMode, itemName: g.itemName,
      status: g.status, tier: g.tier, speed: g.speedRating, price: g.priceRating, qc: qualityUser.name,
    })
    .from(g)
    .leftJoin(qualityUser, eq(g.qualityBy, qualityUser.id))
    .where(and(gte(g.receivedAt, start), lt(g.receivedAt, end)))
    .orderBy(asc(g.receivedAt));
  type Group = { name: string; category: "Material" | "Transportasi"; rows: typeof list };
  const groups = new Map<string, Group>();
  const add = (category: Group["category"], name: string | null, row: (typeof list)[number]) => {
    const clean = name?.trim();
    if (!clean) return;
    const key = `${category}:${clean.toLowerCase()}`;
    const group = groups.get(key) ?? { name: clean, category, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  };
  for (const row of list) {
    add("Material", row.supplier, row);
    if (row.mode === "ekspedisi") add("Transportasi", row.expedition, row);
  }
  const form = FORM_BY_CODE["F-IB-08"], day = todayWib();
  return [...groups.entries()]
    .sort((a, b) => a[1].category.localeCompare(b[1].category) || a[1].name.localeCompare(b[1].name))
    .map(([key, group]) => {
      const items = [...new Set(group.rows.map((r) => r.itemName))].join(", ");
      const material = group.category === "Material";
      // Ketepatan waktu supplier hanya dari kiriman armada sendiri; kiriman via ekspedisi dinilai pada baris ekspedisinya.
      const speed = round1(average(group.rows.filter((r) => !material || r.mode !== "ekspedisi").map((r) => levelScore(r.speed))));
      const rejected = group.rows.filter((r) => r.status === "ditolak").length;
      const price = average(group.rows.map((r) => r.price));
      return appRow(form, `vendor:${key}`, {
        tanggal: wibDate(group.rows[group.rows.length - 1].receivedAt),
        vendor: group.name,
        kategori: group.category,
        pekerjaan: material ? items : `Angkut ${items}`,
        picVendor: null,
        picInternal: [...new Set(group.rows.map((r) => r.qc).filter(Boolean))].join(", ") || null,
        ketepatan: speed,
        kualitas: material ? round1(average(group.rows.map((r) => tierScore(r.tier)))) : null,
        kerapihan: null, keselamatan: null, respon: null, penyelesaian: null,
        catatan: joinText([
          `${group.rows.length} ${material ? "penerimaan" : "pengiriman"}`,
          rejected ? `${rejected} ditolak` : null,
          material && price !== null ? `harga ${PRICE_LABELS[Math.round(price)] ?? "-"}` : null,
          "otomatis dari Barang Masuk",
        ]),
      }, day);
    });
}

/** F-IB-09: barang masuk + tier QC + hasil uji lumpur. */
async function receiptRows(db: OpsDb, range: DayRange, page: Page): Promise<AppPage> {
  const { start, end } = bounds(range);
  const g = schema.goodsReceipts, t = schema.sandTests;
  const list = await db
    .select({
      id: g.id, receivedAt: g.receivedAt, itemName: g.itemName, tag: g.tag, supplier: g.supplier, quarry: g.quarry, expedition: g.expeditionName,
      quantity: g.quantity, unit: g.unit, note: g.deliveryNoteNo, hasBrangkal: g.hasBrangkal, status: g.status, notes: g.notes,
      tier: g.tier, qualityNote: g.qualityNote, qc: qualityUser.name,
    })
    .from(g)
    .leftJoin(qualityUser, eq(g.qualityBy, qualityUser.id))
    .where(and(gte(g.receivedAt, start), lt(g.receivedAt, end)))
    .orderBy(asc(g.receivedAt), asc(g.id))
    .limit(page.limit + 1)
    .offset(page.offset);
  const rows = list.slice(0, page.limit);
  const ids = rows.map((r) => r.id);
  const [tests, extra] = await Promise.all([
    inChunks(ids, (part) =>
      db.select({ receiptId: t.receiptId, siltPercent: t.siltPercent, decision: t.decision, completer: completerUser.name })
        .from(t).leftJoin(completerUser, eq(t.completedBy, completerUser.id))
        .where(and(inArray(t.receiptId, part), eq(t.status, "selesai"))).orderBy(sql`${t.completedAt} desc`),
    ),
    supplementsFor(db, "F-IB-09", ids.map((id) => `receipt:${id}`)),
  ]);
  const form = FORM_BY_CODE["F-IB-09"], day = todayWib();
  return {
    hasMore: list.length > page.limit,
    rows: rows.map((row) => {
      const test = tests.find((x) => x.receiptId === row.id), supplement = extra.get(`receipt:${row.id}`) ?? {};
      return appRow(form, `receipt:${row.id}`, {
        tanggal: wibDate(row.receivedAt),
        suratJalan: row.note,
        supplier: row.supplier ?? row.expedition,
        barang: row.tag ? `${row.itemName} (${row.tag})` : row.itemName,
        jumlah: row.quantity,
        satuan: row.unit,
        hasil: row.status === "ditolak" ? "Ditolak/Retur" : test?.decision === "diterima_bersyarat" ? "Diterima Bersyarat" : "Diterima",
        kondisi: joinText([
          row.quarry ? `asal ${row.quarry}` : null,
          row.tier ? `Tier ${row.tier} ${TIER_LABELS[row.tier as SandTier] ?? ""}`.trim() : null,
          test?.siltPercent != null ? `kadar lumpur ${fmt(test.siltPercent, 2)}%` : null,
          row.hasBrangkal ? "banyak brangkal" : null,
          row.qualityNote,
          row.notes,
        ]),
        tindakan: supplement.tindakan ?? (row.status === "ditolak" ? "Retur ke pemasok" : null),
        paraf: row.qc ?? test?.completer ?? null,
      }, day);
    }),
  };
}

const APP_ROWS: Partial<Record<IsoCode, (db: OpsDb, range: DayRange, page: Page) => Promise<AppPage>>> = {
  "F-IB-01": customerRows,
  "F-IB-02": productionRows,
  "F-IB-03": mixRows,
  "F-IB-04": (db, range, page) => strengthRows(db, range, page),
  "F-IB-09": receiptRows,
  "F-IB-08": async (db, range, page) => (page.offset ? { rows: [], hasMore: false } : { rows: await vendorRows(db, range), hasMore: false }),
};

/** Baris satu form untuk rentang tanggal (bertahap per halaman; isian langsung ikut di halaman pertama). */
export async function listIsoRows(db: OpsDb, input: { code: IsoCode; from: string; to: string; offset: number }) {
  const form = FORM_BY_CODE[input.code];
  if (!form) fail("Form tidak dikenal.");
  const range = { from: input.from, to: input.to };
  const offset = Math.max(0, Math.floor(input.offset) || 0);
  const loader = APP_ROWS[form.code];
  const app = loader ? await loader(db, range, { limit: PAGE_SIZE, offset }) : { rows: [] as IsoRow[], hasMore: false };
  const day = todayWib();
  const manual = form.manual && offset === 0 ? (await manualRecords(db, [form.code], form.master ? null : range)).map((r) => manualRow(r, day)) : [];
  return { rows: [...app.rows, ...manual], nextOffset: app.hasMore ? offset + PAGE_SIZE : null };
}

// ---------------------------------------------------------------------------
// Ringkasan periode (Dashboard + Rekap Bulanan + Sasaran Mutu)
// ---------------------------------------------------------------------------

const firstOfMonth = (day: string) => `${day.slice(0, 7)}-01`;

export async function isoOverview(db: OpsDb, input: DayRange): Promise<IsoOverview> {
  const range = { from: input.from, to: input.to };
  const { start, end } = bounds(range);
  const startSec = Math.floor(start.getTime() / 1000), endSec = Math.floor(end.getTime() / 1000);
  const day = todayWib();
  const manualCodes: IsoCode[] = ["F-IB-04", "F-IB-05", "F-IB-07", "F-IB-08", "F-IB-10", "F-IB-11", "F-IB-12", "F-IB-13", "F-IB-14"];
  const o = schema.orders;

  // Dokumen produksi dihitung dari baris hasilnya; target/reject tingkat dokumen hanya dihitung sekali (rn = 1).
  const productionCte = sql`with x as (
      select p.id as pid, p.category as category, i.name as product, coalesce(l.qty, 0) as qty, p.target as target, p.rejects as rejects,
        row_number() over (partition by p.id order by l.rowid) as rn
      from inv_productions p
      left join inv_production_lines l on l.production_id = p.id and l.role = 'hasil'
      left join fin_items i on i.id = l.item_id
      where p.date >= ${range.from} and p.date <= ${range.to})`;

  const [orderCount, productionTotals, productsMade, mixCount, strength, receiptStats, deliveredStats, records, objectiveValues, vendors] = await Promise.all([
    db.select({ total: count() }).from(o).where(and(gte(o.date, range.from), lte(o.date, range.to), notInArray(o.status, NOT_ORDERS))),
    db.all<{ entries: number; realized: number; rejects: number; target: number; realizedWithTarget: number }>(sql`${productionCte}
      select count(distinct pid) as entries, coalesce(sum(qty), 0) as realized,
        coalesce(sum(case when rn = 1 then rejects end), 0) as rejects,
        coalesce(sum(case when rn = 1 and target > 0 then target end), 0) as target,
        coalesce(sum(case when target > 0 then qty end), 0) as realizedWithTarget
      from x`),
    db.all<{ category: string | null; product: string | null; quantity: number; rejects: number }>(sql`${productionCte}
      select category, product, coalesce(sum(qty), 0) as quantity, coalesce(sum(case when rn = 1 then coalesce(rejects, 0) else 0 end), 0) as rejects
      from x group by category, product`),
    db.select({ total: count() }).from(schema.mixLogs).where(and(gte(schema.mixLogs.workDate, range.from), lte(schema.mixLogs.workDate, range.to))),
    strengthRows(db, range, { limit: 3000, offset: 0 }, false),
    db.select({ total: count(), rejected: sql<number>`coalesce(sum(case when ${schema.goodsReceipts.status} = 'ditolak' then 1 else 0 end), 0)` })
      .from(schema.goodsReceipts).where(and(gte(schema.goodsReceipts.receivedAt, start), lt(schema.goodsReceipts.receivedAt, end))),
    // Pengiriman terkirim pada periode: tepat waktu (selesai <= tanggal kirim diminta PO) dan terpantau GPS (ada posisi truk selama perjalanan).
    db.all<{ total: number; onTime: number; tracked: number }>(sql`
      select count(*) as total,
        coalesce(sum(case when coalesce(o.requested_date, '') = '' or date(d.delivered_at + 25200, 'unixepoch') <= o.requested_date then 1 else 0 end), 0) as onTime,
        coalesce(sum(case when d.vehicle_id is not null and d.departed_at is not null and exists (
          select 1 from ops_positions p where p.vehicle_id = d.vehicle_id and p.at >= d.departed_at and p.at <= d.delivered_at + 300) then 1 else 0 end), 0) as tracked
      from ops_deliveries d join ops_orders o on o.id = d.order_id
      where d.status = 'terkirim' and d.delivered_at >= ${startSec} and d.delivered_at < ${endSec}`),
    db.select().from(ir).where(and(eq(ir.kind, "record"), or(and(inArray(ir.formCode, manualCodes), gte(ir.recordDate, range.from), lte(ir.recordDate, range.to)), inArray(ir.formCode, ["F-IB-06", "F-IB-15"])))),
    db.select({ data: ir.data, recordDate: ir.recordDate }).from(ir)
      .where(and(eq(ir.formCode, "F-IB-16"), eq(ir.kind, "objective"), gte(ir.recordDate, firstOfMonth(range.from)), lte(ir.recordDate, range.to))),
    vendorRows(db, range),
  ]);

  const manual = records.filter((r) => manualCodes.includes(r.formCode as IsoCode));
  const schedules = records.filter((r) => r.formCode === "F-IB-06");
  const ncrs = records.filter((r) => r.formCode === "F-IB-15");
  const rowsOf = (code: IsoCode) => manual.filter((r) => r.formCode === code).map((r) => manualRow(r, day).values);
  const countOf = (code: IsoCode) => manual.filter((r) => r.formCode === code).length;
  const inRange = (value: unknown) => isDay(value) && value >= range.from && value <= range.to;

  const tests = [...strength.rows.map((r) => r.values), ...rowsOf("F-IB-04")].filter((v) => v.statusUji);
  const machineLogs = rowsOf("F-IB-07");
  const environment = rowsOf("F-IB-05").filter((v) => v.status);
  const warehouse = rowsOf("F-IB-12").map((v) => num(v.skor)).filter((v): v is number => v !== null);
  const scheduleRows = schedules.map((r) => manualRow(r, day).values);
  const ncrRows = ncrs.map((r) => manualRow(r, day).values);
  const ncrInRange = ncrRows.filter((v) => inRange(v.tanggal));
  const vendorScores = [...vendors.map((r) => r.values), ...rowsOf("F-IB-08")].map((v) => num(v.nilai)).filter((v): v is number => v !== null);
  const production = productionTotals[0];
  const delivered = { total: Number(deliveredStats[0]?.total ?? 0), onTime: Number(deliveredStats[0]?.onTime ?? 0), tracked: Number(deliveredStats[0]?.tracked ?? 0) };

  const counts = Object.fromEntries(ISO_CODES.map((code) => [code, 0])) as Record<IsoCode, number>;
  counts["F-IB-01"] = orderCount[0]?.total ?? 0;
  counts["F-IB-02"] = Number(production?.entries ?? 0);
  counts["F-IB-03"] = mixCount[0]?.total ?? 0;
  counts["F-IB-04"] = strength.rows.length + countOf("F-IB-04");
  counts["F-IB-06"] = scheduleRows.filter((v) => inRange(v.berikutnya)).length;
  counts["F-IB-08"] = vendors.length + countOf("F-IB-08");
  counts["F-IB-09"] = receiptStats[0]?.total ?? 0;
  counts["F-IB-15"] = ncrInRange.length;
  for (const code of ["F-IB-05", "F-IB-07", "F-IB-10", "F-IB-11", "F-IB-12", "F-IB-13", "F-IB-14"] as const) counts[code] = countOf(code);

  // Sasaran Mutu: angka otomatis dari data aplikasi, sisanya dari isian manual per bulan.
  const complaints = (categories: string[]) => ncrInRange.filter((v) => categories.includes(String(v.kategori ?? ""))).length;
  const testsOf = (classes: string[]) => {
    const list = tests.filter((v) => classes.includes(productClass(String(v.produk ?? ""))));
    return { total: list.length, achieved: list.filter((v) => v.statusUji === "LULUS").length };
  };
  const made = (cls: string) =>
    productsMade
      .filter((row) => productClass(row.product ?? "", row.category) === cls)
      .reduce((sum, row) => ({ total: sum.total + Number(row.quantity) + Number(row.rejects), achieved: sum.achieved + Number(row.quantity) }), { total: 0, achieved: 0 });
  const keluhan = ncrInRange.filter((v) => v.sumber === "Keluhan Pelanggan");
  const auto: Record<ObjectiveAuto, { total: number; achieved: number }> = {
    "test:paving": testsOf(["paving"]), "test:uditch": testsOf(["uditch"]), "test:kanstin": testsOf(["kanstin"]),
    "test:buis": testsOf(["buisVibrasi", "buisTumbuk"]), "test:greffel": testsOf(["greffel"]),
    "delivery:onTime": { total: delivered.total, achieved: delivered.onTime },
    "delivery:gps": { total: delivered.total, achieved: delivered.tracked },
    "complaint:quantity": { total: delivered.total, achieved: Math.max(0, delivered.total - complaints(["Jumlah/jenis tidak sesuai"])) },
    "complaint:quality": { total: delivered.total, achieved: Math.max(0, delivered.total - complaints(["Mutu produk"])) },
    "complaint:delivery": { total: delivered.total, achieved: Math.max(0, delivered.total - complaints(["Terlambat", "Jumlah/jenis tidak sesuai", "Rusak saat tiba"])) },
    "complaint:service": { total: counts["F-IB-01"], achieved: Math.max(0, counts["F-IB-01"] - complaints(["Pelayanan"])) },
    "complaint:closed7": {
      total: keluhan.length,
      achieved: keluhan.filter((v) => v.status === "Closed" && isDay(v.closed) && isDay(v.tanggal) && workingDaysBetween(v.tanggal, v.closed) <= 7).length,
    },
    "reject:paving": made("paving"), "reject:uditch": made("uditch"), "reject:kanstin": made("kanstin"),
    "reject:buisVibrasi": made("buisVibrasi"), "reject:buisTumbuk": made("buisTumbuk"), "reject:greffel": made("greffel"),
  };
  const objectives = QUALITY_OBJECTIVES.map((objective) => {
    if (objective.auto) {
      const value = auto[objective.auto];
      return { no: objective.no, total: value.total || null, achieved: value.total ? value.achieved : null, source: "auto" as const, months: [] as string[] };
    }
    const entries = objectiveValues.filter((r) => Number(r.data.no) === objective.no);
    const total = entries.reduce((sum, r) => sum + (num(r.data.total) ?? 0), 0);
    const achieved = entries.reduce((sum, r) => sum + (num(r.data.achieved) ?? 0), 0);
    return {
      no: objective.no,
      total: entries.length ? total : null,
      achieved: entries.length ? achieved : null,
      source: entries.length ? ("manual" as const) : null,
      months: entries.map((r) => r.recordDate.slice(0, 7)).sort(),
    };
  });

  return {
    range, today: day, counts,
    tests: { total: tests.length, passed: tests.filter((v) => v.statusUji === "LULUS").length },
    production: {
      entries: Number(production?.entries ?? 0), target: Number(production?.target ?? 0), realized: Number(production?.realized ?? 0),
      realizedWithTarget: Number(production?.realizedWithTarget ?? 0), rejects: Number(production?.rejects ?? 0),
    },
    machine: {
      breakdowns: machineLogs.filter((v) => v.jenis === "Kerusakan/Gangguan").length,
      downtime: machineLogs.reduce((sum, v) => sum + (num(v.downtime) ?? 0), 0),
      openNow: machineLogs.filter((v) => v.status === "Open").length,
      dueInRange: counts["F-IB-06"],
      overdueNow: scheduleRows.filter((v) => v.status === "TERLAMBAT").length,
      soonNow: scheduleRows.filter((v) => v.status === "SEGERA").length,
      equipment: scheduleRows.length,
    },
    environment: { total: environment.length, ok: environment.filter((v) => v.status === "Sesuai").length },
    material: { total: receiptStats[0]?.total ?? 0, rejected: Number(receiptStats[0]?.rejected ?? 0) },
    ncr: {
      opened: ncrInRange.length,
      closed: ncrRows.filter((v) => v.status === "Closed" && inRange(v.closed)).length,
      complaints: keluhan.length,
      openNow: ncrRows.filter((v) => v.status === "Open").length,
    },
    warehouse: { total: warehouse.length, avgScore: warehouse.length ? warehouse.reduce((sum, v) => sum + v, 0) / warehouse.length : null },
    vendor: { evaluated: vendorScores.length, avgScore: vendorScores.length ? vendorScores.reduce((sum, v) => sum + v, 0) / vendorScores.length : null },
    meetings: { decisions: counts["F-IB-14"], overdueNow: rowsOf("F-IB-14").filter((v) => v.ketepatan === "TERLAMBAT").length },
    objectives,
  };
}

/** Angka manual Sasaran Mutu untuk satu bulan (untuk diisi/diubah). */
export async function objectiveMonth(db: OpsDb, month: string) {
  const rows = await db.select({ data: ir.data }).from(ir).where(and(eq(ir.formCode, "F-IB-16"), eq(ir.kind, "objective"), eq(ir.recordDate, `${month}-01`)));
  return rows.map((r) => ({ no: Number(r.data.no), total: num(r.data.total), achieved: num(r.data.achieved), note: r.data.note ? String(r.data.note) : null }));
}

// ---------------------------------------------------------------------------
// Saran pengisian dari data aplikasi (supaya tidak ada yang terlewat)
// ---------------------------------------------------------------------------

export type IsoSuggestion = { from: string; label: string; values: IsoValues };
export const SUGGESTION_FORMS: readonly IsoCode[] = ["F-IB-07", "F-IB-14", "F-IB-15"];

export async function isoSuggestions(db: OpsDb, input: { code: IsoCode; from: string; to: string }): Promise<IsoSuggestion[]> {
  if (!SUGGESTION_FORMS.includes(input.code)) return [];
  const range = { from: input.from, to: input.to };
  const { start, end } = bounds(range);
  const usedRows = await db
    .select({ from: sql<string | null>`json_extract(${ir.data}, '$._from')` })
    .from(ir)
    .where(and(eq(ir.formCode, input.code), eq(ir.kind, "record"), sql`json_extract(${ir.data}, '$._from') is not null`));
  const used = new Set(usedRows.map((r) => r.from));
  const out: IsoSuggestion[] = [];
  if (input.code === "F-IB-07") {
    const rows = await db.all<{ id: string; date: string; note: string; leader: string | null; creator: string | null; product: string | null }>(sql`
      select p.id as id, p.date as date, p.note as note, p.leader as leader, u.name as creator,
        (select i.name from inv_production_lines l join fin_items i on i.id = l.item_id where l.production_id = p.id and l.role = 'hasil' order by l.rowid limit 1) as product
      from inv_productions p left join users u on u.id = p.created_by
      where p.date >= ${range.from} and p.date <= ${range.to} and p.issues like '%Mesin trouble%'
      order by p.date`);
    for (const row of rows) {
      out.push({
        from: `production:${row.id}`,
        label: `Mesin trouble · ${row.product ?? "produksi"} · ${row.leader ?? row.creator ?? "-"}`,
        values: { tanggal: row.date, jenis: "Kerusakan/Gangguan", kondisi: "Perlu Perbaikan", uraian: row.note || "Mesin trouble (dari laporan Hasil Produksi)" },
      });
    }
  } else if (input.code === "F-IB-14") {
    const ce = schema.calendarEvents;
    const rows = await db
      .select({ id: ce.id, title: ce.title, startAt: ce.startAt, people: sql<number>`(select count(*) from ops_calendar_participants cp where cp.event_id = ${ce.id})` })
      .from(ce)
      .where(and(eq(ce.type, "rapat"), gte(ce.startAt, start), lt(ce.startAt, end), lt(ce.startAt, new Date())))
      .orderBy(asc(ce.startAt));
    for (const row of rows) {
      out.push({ from: `event:${row.id}`, label: `Rapat: ${row.title}`, values: { tanggal: wibDate(row.startAt), jenis: "Koordinasi", topik: row.title, peserta: Number(row.people) || null, status: "Open" } });
    }
  } else if (input.code === "F-IB-15") {
    const g = schema.goodsReceipts;
    const [rejected, strength] = await Promise.all([
      db.select({ id: g.id, date: g.receivedAt, itemName: g.itemName, supplier: g.supplier, quantity: g.quantity, notes: g.notes, qualityNote: g.qualityNote })
        .from(g).where(and(eq(g.status, "ditolak"), gte(g.receivedAt, start), lt(g.receivedAt, end))).orderBy(asc(g.receivedAt)),
      strengthRows(db, range, { limit: 3000, offset: 0 }, false),
    ]);
    for (const row of rejected) {
      out.push({
        from: `receipt:${row.id}`,
        label: `Barang masuk ditolak: ${row.itemName}${row.supplier ? ` dari ${row.supplier}` : ""}`,
        values: { tanggal: wibDate(row.date), sumber: "Material Masuk", uraian: joinText([`${row.itemName} ditolak saat diterima`, row.qualityNote, row.notes]), produk: row.itemName, jumlah: row.quantity, disposisi: "Retur ke Pemasok", status: "Open" },
      });
    }
    for (const row of strength.rows.filter((item) => item.values.statusUji === "TIDAK LULUS")) {
      const v = row.values;
      out.push({
        from: row.key,
        label: `Uji tekan tidak memenuhi: ${v.produk}`,
        values: { tanggal: v.tanggalUji, sumber: "Produk Reject", uraian: `Kuat tekan ${fmt(num(v.kgcm2) ?? 0, 2)} kg/cm² di bawah target (${v.mutu}, umur ${v.umur ?? "-"} hari)`, produk: v.produk, status: "Open" },
      });
    }
  }
  return out.filter((item) => !used.has(item.from)).slice(0, 40);
}

// ---------------------------------------------------------------------------
// Jadwal jatuh tempo (halaman & cron pengingat)
// ---------------------------------------------------------------------------

/** F-IB-06 TERLAMBAT/SEGERA, NCR Open lewat target, dan tindak lanjut rapat TERLAMBAT per hari ini. */
export async function loadIsoAlerts(db: OpsDb, day: string) {
  const records = await db.select().from(ir).where(and(inArray(ir.formCode, ["F-IB-06", "F-IB-14", "F-IB-15"]), eq(ir.kind, "record")));
  const rows = records.map((r) => ({ code: r.formCode as IsoCode, values: manualRow(r, day).values }));
  const schedules = rows.filter((r) => r.code === "F-IB-06");
  return {
    late: schedules.filter((r) => r.values.status === "TERLAMBAT"),
    soon: schedules.filter((r) => r.values.status === "SEGERA"),
    ncr: rows.filter((r) => r.code === "F-IB-15" && r.values.status === "Open" && isDay(r.values.target) && r.values.target < day),
    meetings: rows.filter((r) => r.code === "F-IB-14" && r.values.ketepatan === "TERLAMBAT"),
  };
}
