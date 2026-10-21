import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { getDb, schema } from "@/db";
import type { MaterialLine, MixDesignStatus } from "@/db/erp";
import type { CurrentUser } from "@/lib/auth";
import type { DB } from "@/lib/erp/server";
import { addDays, today } from "@/lib/erp/util";
import { can, type Role } from "@/lib/roles";
import { evaluateSample, type SampleResult } from "@/lib/ops/shared/strength";

/* ------------------------------------------------------------ izin */

/**
 * Hak QC seorang pengguna.
 * - input: mengisi catatan harian, uji kuat tekan, mengajukan template (izin qc)
 * - approve: ACC catatan/uji, meninjau template (izin setujui_qc)
 * - sign: TTD "Mengetahui Pimpinan" (izin ttd_pimpinan)
 * - editAny: boleh mengubah/menghapus data buatan orang lain (padanan "kantor" di aplikasi lama: pemilik, manajer QC, operasional)
 */
export function qcCan(roles: readonly Role[]) {
  const approve = can(roles, "setujui_qc");
  return { input: can(roles, "qc"), approve, sign: can(roles, "ttd_pimpinan"), editAny: approve || roles.includes("operasional") };
}

/* ------------------------------------------------------------ notifikasi */

export type QcPending = { mixToApprove: number; strengthToApprove: number; strengthToSign: number; mixRevisions: number; strengthRevisions: number; total: number };

/**
 * Hal yang menunggu tindakan akun ini: catatan harian & uji tekan menunggu ACC, uji tekan menunggu TTD pimpinan,
 * dan (peran qc) data miliknya yang dikembalikan untuk revisi. Satu kueri; tanpa kueri bila akun tak berkepentingan.
 * Dipakai halaman QC dan lencana menu.
 */
export async function qcPending(me: Pick<CurrentUser, "id" | "roles">, db?: DB): Promise<QcPending> {
  const c = qcCan(me.roles);
  const isQc = me.roles.includes("qc");
  const zero = { mixToApprove: 0, strengthToApprove: 0, strengthToSign: 0, mixRevisions: 0, strengthRevisions: 0, total: 0 };
  if (!c.approve && !c.sign && !isQc) return zero;
  const d = db ?? (await getDb());
  const pick = (on: boolean, q: SQL) => (on ? q : sql`0`);
  const row = await d.get<Omit<QcPending, "total">>(sql`select
    ${pick(c.approve, sql`(select count(*) from qc_mix_logs where review_status = 'menunggu')`)} as mixToApprove,
    ${pick(c.approve, sql`(select count(*) from qc_strength_tests where review_status = 'menunggu')`)} as strengthToApprove,
    ${pick(c.sign, sql`(select count(*) from qc_strength_tests where review_status = 'disetujui' and leader_signed_at is null)`)} as strengthToSign,
    ${pick(isQc, sql`(select count(*) from qc_mix_logs where review_status = 'revisi' and created_by = ${me.id})`)} as mixRevisions,
    ${pick(isQc, sql`(select count(*) from qc_strength_tests where review_status = 'revisi' and created_by = ${me.id})`)} as strengthRevisions`);
  if (!row) return zero;
  const v = { mixToApprove: Number(row.mixToApprove), strengthToApprove: Number(row.strengthToApprove), strengthToSign: Number(row.strengthToSign), mixRevisions: Number(row.mixRevisions), strengthRevisions: Number(row.strengthRevisions) };
  return { ...v, total: v.mixToApprove + v.strengthToApprove + v.strengthToSign + v.mixRevisions + v.strengthRevisions };
}

/* ------------------------------------------------------------ template mix desain */

const creator = alias(schema.users, "creator");
const approver = alias(schema.users, "approver");
const retirer = alias(schema.users, "retirer");
const manager = alias(schema.users, "manager");
const lab = alias(schema.users, "lab");
const leader = alias(schema.users, "leader");

export type MixDesignRow = {
  id: string;
  name: string;
  layer: "badan" | "kepalaan" | "lainnya";
  product: string;
  materials: MaterialLine[];
  notes: string;
  status: MixDesignStatus;
  active: boolean;
  reviewNote: string | null;
  createdByName: string | null;
  approvedByName: string | null;
  retiredReason: string | null;
  retiredAt: Date | null;
  retiredByName: string | null;
  usage: { logs: number; firstUsed: string; lastUsed: string; boards: number; squareMeters: number; rejects: number; notOk: number } | null;
};

/** Semua template + rekap pemakaiannya di catatan harian. */
export async function listMixDesigns(db: DB): Promise<MixDesignRow[]> {
  const d = schema.mixDesigns;
  const l = schema.mixLogs;
  const [designs, usage] = await Promise.all([
    db
      .select({
        id: d.id, name: d.name, layer: d.layer, product: d.product, materials: d.materials, notes: d.notes, status: d.status, active: d.active, reviewNote: d.reviewNote,
        createdByName: creator.name, approvedByName: approver.name, retiredReason: d.retiredReason, retiredAt: d.retiredAt, retiredByName: retirer.name,
      })
      .from(d)
      .leftJoin(creator, eq(d.createdBy, creator.id))
      .leftJoin(approver, eq(d.approvedBy, approver.id))
      .leftJoin(retirer, eq(d.retiredBy, retirer.id))
      .orderBy(desc(d.active), d.layer, desc(d.createdAt)),
    db
      .select({
        mixDesignId: l.mixDesignId,
        logs: sql<number>`count(*)`,
        firstUsed: sql<string>`min(${l.workDate})`,
        lastUsed: sql<string>`max(${l.workDate})`,
        boards: sql<number>`coalesce(sum(${l.boards}), 0)`,
        squareMeters: sql<number>`coalesce(sum(${l.squareMeters}), 0)`,
        rejects: sql<number>`coalesce(sum(${l.rejects}), 0)`,
        notOk: sql<number>`sum(case when ${l.status} = 'sesuai' then 0 else 1 end)`,
      })
      .from(l)
      .where(sql`${l.mixDesignId} is not null`)
      .groupBy(l.mixDesignId),
  ]);
  const byId = new Map(usage.map((u) => [u.mixDesignId, u]));
  return designs.map((x) => {
    const u = byId.get(x.id);
    return { ...x, usage: u ? { logs: Number(u.logs), firstUsed: u.firstUsed, lastUsed: u.lastUsed, boards: Number(u.boards), squareMeters: Number(u.squareMeters), rejects: Number(u.rejects), notOk: Number(u.notOk) } : null };
  });
}

/** Template yang boleh dipilih saat mengisi catatan harian: disetujui & aktif. */
export const isInUse = (d: Pick<MixDesignRow, "status" | "active">) => d.status === "disetujui" && d.active;
export const isPendingDesign = (d: Pick<MixDesignRow, "status" | "active">) => d.status === "diajukan" && d.active;

/* ------------------------------------------------------------ catatan harian */

export type MixLogRow = {
  id: string;
  workDate: string;
  layer: "badan" | "kepalaan" | "lainnya";
  product: string;
  mixDesignId: string | null;
  approvedMaterials: MaterialLine[];
  actualMaterials: MaterialLine[];
  mixingCount: number | null;
  boards: number | null;
  squareMeters: number | null;
  rejects: number | null;
  status: "sesuai" | "tidak_sesuai" | "perlu_perbaikan";
  notes: string;
  reviewStatus: "menunggu" | "disetujui" | "revisi";
  reviewNote: string | null;
  createdBy: number | null;
  createdByName: string | null;
  managerSignedByName: string | null;
  managerSignatureKey: string | null;
  managerSignedAt: Date | null;
};

const mixLogColumns = () => {
  const l = schema.mixLogs;
  return {
    id: l.id, workDate: l.workDate, layer: l.layer, product: l.product, mixDesignId: l.mixDesignId, approvedMaterials: l.approvedMaterials, actualMaterials: l.actualMaterials,
    mixingCount: l.mixingCount, boards: l.boards, squareMeters: l.squareMeters, rejects: l.rejects, status: l.status, notes: l.notes, reviewStatus: l.reviewStatus, reviewNote: l.reviewNote,
    createdBy: l.createdBy, createdByName: creator.name, managerSignedByName: manager.name, managerSignatureKey: manager.signatureKey, managerSignedAt: l.managerSignedAt,
  };
};

/** Catatan harian dalam rentang tanggal (YYYY-MM-DD, inklusif), urut tanggal, lapisan, waktu input. */
export async function listMixLogs(db: DB, from: string, to: string, layer?: string): Promise<MixLogRow[]> {
  const l = schema.mixLogs;
  return db
    .select(mixLogColumns())
    .from(l)
    .leftJoin(creator, eq(l.createdBy, creator.id))
    .leftJoin(manager, eq(l.managerSignedBy, manager.id))
    .where(and(gte(l.workDate, from), lte(l.workDate, to), layer ? eq(l.layer, layer as "badan") : undefined))
    .orderBy(asc(l.workDate), l.layer, asc(l.createdAt));
}

export async function getMixLog(db: DB, id: string): Promise<MixLogRow | undefined> {
  const l = schema.mixLogs;
  const rows = await db.select(mixLogColumns()).from(l).leftJoin(creator, eq(l.createdBy, creator.id)).leftJoin(manager, eq(l.managerSignedBy, manager.id)).where(eq(l.id, id)).limit(1);
  return rows[0];
}

/**
 * Hasil produksi paving per produk dari catatan mix desain lapisan BADAN pada rentang tanggal.
 * Dipakai tombol "Isi dari catatan mix desain" di input hasil produksi (paket produksi).
 */
export async function pavingFromMixLogs(db: DB, from: string, to: string) {
  const l = schema.mixLogs;
  const rows = await db
    .select({ product: l.product, boards: l.boards, squareMeters: l.squareMeters, rejects: l.rejects })
    .from(l)
    .where(and(eq(l.layer, "badan"), gte(l.workDate, from), lte(l.workDate, to)));
  const byProduct = new Map<string, { product: string; boards: number; squareMeters: number; rejects: number }>();
  for (const r of rows) {
    const e = byProduct.get(r.product) ?? { product: r.product, boards: 0, squareMeters: 0, rejects: 0 };
    e.boards += r.boards ?? 0;
    e.squareMeters += r.squareMeters ?? 0;
    e.rejects += r.rejects ?? 0;
    byProduct.set(r.product, e);
  }
  return [...byProduct.values()];
}

/** Hari dalam rentang (sampai hari ini) yang belum punya catatan, per lapisan badan & kepalaan. */
export function missingMixDays(logs: Pick<MixLogRow, "workDate" | "layer">[], from: string, to: string) {
  const last = to < today() ? to : today();
  const have = new Set(logs.map((x) => `${x.workDate}|${x.layer}`));
  const out: { date: string; layers: ("badan" | "kepalaan")[] }[] = [];
  for (let day = from, n = 0; day <= last && n < 400; day = addDays(day, 1), n++) {
    const layers = (["badan", "kepalaan"] as const).filter((layer) => !have.has(`${day}|${layer}`));
    if (layers.length) out.push({ date: day, layers });
  }
  return out;
}

/* ------------------------------------------------------------ uji kuat tekan */

export type StrengthSampleRow = {
  id: string;
  position: number;
  sampleName: string;
  madeAt: string | null;
  testedAt: string | null;
  weightKg: number | null;
  areaCm2: number | null;
  maxLoadKn: number | null;
} & SampleResult;

export type StrengthTestRow = {
  id: string;
  reportDate: string;
  companyName: string;
  address: string;
  concreteGrade: string;
  addressedTo: string;
  composition: MaterialLine[];
  notes: string;
  reviewStatus: "menunggu" | "disetujui" | "revisi";
  reviewNote: string | null;
  createdBy: number | null;
  createdByName: string | null;
  labSignedByName: string | null;
  labSignatureKey: string | null;
  labSignedAt: Date | null;
  leaderSignedByName: string | null;
  leaderSignatureKey: string | null;
  leaderSignedAt: Date | null;
  samples: StrengthSampleRow[];
};

const testColumns = () => {
  const t = schema.strengthTests;
  return {
    id: t.id, reportDate: t.reportDate, companyName: t.companyName, address: t.address, concreteGrade: t.concreteGrade, addressedTo: t.addressedTo, composition: t.composition, notes: t.notes,
    reviewStatus: t.reviewStatus, reviewNote: t.reviewNote, createdBy: t.createdBy, createdByName: creator.name,
    labSignedByName: lab.name, labSignatureKey: lab.signatureKey, labSignedAt: t.labSignedAt,
    leaderSignedByName: leader.name, leaderSignatureKey: leader.signatureKey, leaderSignedAt: t.leaderSignedAt,
  };
};

function withSamples(tests: Omit<StrengthTestRow, "samples">[], samples: (typeof schema.strengthSamples.$inferSelect)[]): StrengthTestRow[] {
  const byTest = new Map<string, typeof samples>();
  for (const s of samples) byTest.set(s.testId, [...(byTest.get(s.testId) ?? []), s]);
  return tests.map((t) => ({
    ...t,
    samples: (byTest.get(t.id) ?? []).map((s) => ({ id: s.id, position: s.position, sampleName: s.sampleName, madeAt: s.madeAt, testedAt: s.testedAt, weightKg: s.weightKg, areaCm2: s.areaCm2, maxLoadKn: s.maxLoadKn, ...evaluateSample(t.concreteGrade, s) })),
  }));
}

/** Laporan uji kuat tekan dalam rentang tanggal laporan, lengkap dengan benda uji yang sudah dievaluasi. */
export async function listStrengthTests(db: DB, from: string, to: string): Promise<StrengthTestRow[]> {
  const t = schema.strengthTests;
  const inRange = and(gte(t.reportDate, from), lte(t.reportDate, to));
  const [tests, samples] = await Promise.all([
    db.select(testColumns()).from(t).leftJoin(creator, eq(t.createdBy, creator.id)).leftJoin(lab, eq(t.labSignedBy, lab.id)).leftJoin(leader, eq(t.leaderSignedBy, leader.id)).where(inRange).orderBy(desc(t.reportDate), desc(t.createdAt)),
    db.select().from(schema.strengthSamples).where(inArray(schema.strengthSamples.testId, db.select({ id: t.id }).from(t).where(inRange))).orderBy(schema.strengthSamples.testId, schema.strengthSamples.position),
  ]);
  return withSamples(tests, samples);
}

export async function getStrengthTest(db: DB, id: string): Promise<StrengthTestRow | undefined> {
  const t = schema.strengthTests;
  const [tests, samples] = await Promise.all([
    db.select(testColumns()).from(t).leftJoin(creator, eq(t.createdBy, creator.id)).leftJoin(lab, eq(t.labSignedBy, lab.id)).leftJoin(leader, eq(t.leaderSignedBy, leader.id)).where(eq(t.id, id)).limit(1),
    db.select().from(schema.strengthSamples).where(eq(schema.strengthSamples.testId, id)).orderBy(schema.strengthSamples.position),
  ]);
  return withSamples(tests, samples)[0];
}

/* ------------------------------------------------------------ rekap */

const sum = (values: (number | null | undefined)[]) => values.reduce<number>((total, v) => total + (v ?? 0), 0);
const avg = (values: number[]) => (values.length ? sum(values) / values.length : null);

export type MixSummary = { days: number; logs: number; boards: number; m2: number; rejects: number; ok: number; notOk: number; approved: number; waiting: number; revision: number };

function mixSummary(logs: MixLogRow[]): MixSummary {
  return {
    days: new Set(logs.map((x) => x.workDate)).size,
    logs: logs.length,
    boards: sum(logs.map((x) => x.boards)),
    m2: sum(logs.filter((x) => x.layer !== "kepalaan").map((x) => x.squareMeters)),
    rejects: sum(logs.map((x) => x.rejects)),
    ok: logs.filter((x) => x.status === "sesuai").length,
    notOk: logs.filter((x) => x.status !== "sesuai").length,
    approved: logs.filter((x) => x.reviewStatus === "disetujui").length,
    waiting: logs.filter((x) => x.reviewStatus === "menunggu").length,
    revision: logs.filter((x) => x.reviewStatus === "revisi").length,
  };
}

export type StrengthSummary = { reports: number; samples: number; passed: number; failed: number; avgStrength: number | null; labSigned: number; leaderSigned: number };

function strengthSummary(tests: StrengthTestRow[]): StrengthSummary {
  const samples = tests.flatMap((t) => t.samples);
  const strengths = samples.flatMap((s) => (s.strength === null ? [] : [s.strength]));
  return {
    reports: tests.length,
    samples: samples.length,
    passed: samples.filter((s) => s.passed === true).length,
    failed: samples.filter((s) => s.passed === false).length,
    avgStrength: avg(strengths),
    labSigned: tests.filter((t) => t.reviewStatus === "disetujui").length,
    leaderSigned: tests.filter((t) => t.leaderSignedAt).length,
  };
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const monthLabel = (key: string) => `${BULAN[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;

/** Bulan (YYYY-MM) dari awal sampai akhir rentang, tidak melewati bulan ini. */
function monthsBetween(from: string, to: string) {
  const end = (to < today() ? to : today()).slice(0, 7);
  const keys: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  while (`${y}-${String(m).padStart(2, "0")}` <= end && keys.length < 60) {
    keys.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) { m = 1; y++; }
  }
  return keys;
}

export type QcRecap = ReturnType<typeof qcRecap>;

/** Ringkasan mix desain harian & uji kuat tekan per bulan/template/benda uji untuk satu rentang tanggal. */
export function qcRecap(logs: MixLogRow[], tests: StrengthTestRow[], designs: MixDesignRow[], range: { from: string; to: string }) {
  const designById = new Map(designs.map((d) => [d.id, d]));
  const mixMonths = [...groupBy(logs, (x) => x.workDate.slice(0, 7)).entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, items]) => ({ key, label: monthLabel(key), ...mixSummary(items) }));
  const mixTemplates = [...groupBy(logs, (x) => x.mixDesignId ?? "-").entries()]
    .map(([key, items]) => {
      const design = key === "-" ? null : designById.get(key) ?? null;
      const status = !design ? "-" : isInUse(design) ? "Sedang dipakai" : design.status === "gagal" ? "Gagal (rekapan)" : "Rekapan";
      return { key, name: design?.name ?? "Tanpa template", layer: design ? design.layer : items[0].layer, product: design?.product ?? items[0].product, status, ...mixSummary(items) };
    })
    .sort((a, b) => b.logs - a.logs);
  const strengthMonths = [...groupBy(tests, (x) => x.reportDate.slice(0, 7)).entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, items]) => ({ key, label: monthLabel(key), ...strengthSummary(items) }));
  const samples = tests.flatMap((t) => t.samples.map((s) => ({ ...s, grade: t.concreteGrade })));
  const strengthProducts = [...groupBy(samples, (s) => `${s.grade}|${s.sampleName.trim().toLowerCase()}`).entries()]
    .map(([key, items]) => {
      const strengths = items.flatMap((s) => (s.strength === null ? [] : [s.strength]));
      const targets = items.flatMap((s) => (s.target === null ? [] : [s.target]));
      const ages = items.flatMap((s) => (s.ageDays === null ? [] : [s.ageDays]));
      return {
        key, grade: items[0].grade, name: items[0].sampleName, count: items.length,
        passed: items.filter((s) => s.passed === true).length, failed: items.filter((s) => s.passed === false).length,
        avgAge: avg(ages), avgStrength: avg(strengths), avgTarget: avg(targets),
        min: strengths.length ? Math.min(...strengths) : null, max: strengths.length ? Math.max(...strengths) : null,
      };
    })
    .sort((a, b) => a.grade.localeCompare(b.grade) || a.name.localeCompare(b.name));
  // Uji tekan dijadwalkan sebulan sekali: periksa mulai bulan pertama yang punya data QC (bukan sejak awal rentang bila aplikasi belum dipakai).
  const tested = new Set(strengthMonths.map((m) => m.key));
  const firstMonth = [...mixMonths, ...strengthMonths].map((m) => m.key).sort()[0];
  const missingStrengthMonths = firstMonth ? monthsBetween(`${firstMonth}-01` > range.from ? `${firstMonth}-01` : range.from, range.to).filter((k) => !tested.has(k)).map(monthLabel) : [];
  return { mix: mixSummary(logs), strength: strengthSummary(tests), mixMonths, mixTemplates, strengthMonths, strengthProducts, missingStrengthMonths };
}
