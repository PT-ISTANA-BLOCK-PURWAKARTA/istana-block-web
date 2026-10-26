import "server-only";
import { and, eq } from "drizzle-orm";
import { schema } from "@/db";
import type { Item, ProductionCategory, ProductionMethod } from "@/db/erp";
import { deleteJournalOps, insertMany, inventoryAccount, journalOps, nextNumber, runBatch, type Accounts, type DB, type JLine } from "@/lib/erp/server";
import { batchPrefixFor, nextBatchCode } from "@/lib/ops/production";

type Op = Parameters<typeof runBatch>[1][number];

export type SimpleProduction = {
  /** Dokumen yang diganti (nomor & kode batch dipertahankan). */
  existing?: typeof schema.productions.$inferSelect;
  date: string;
  category: ProductionCategory;
  /** Hasil: qty > 0 memposting stok, qty 0 hanya dicatat. */
  lines: { itemId: string; qty: number }[];
  items: Map<string, Pick<Item, "id" | "name" | "kind" | "buyPrice">>;
  gradeB: number | null;
  rejects: number | null;
  boards?: number | null;
  target?: number | null;
  leader?: string | null;
  note?: string;
  method?: ProductionMethod | null;
  cementBags?: number | null;
  cementKg?: number | null;
  batchId?: string | null;
  mixLogId?: string | null;
  /** Reset keempat kolom TTD ketidaksesuaian (nilai berubah). */
  resetSign?: boolean;
  createdBy: number | null;
};

/**
 * Dokumen hasil produksi tanpa bahan terpakai (adukan cor bersama, baris otomatis dari mix desain):
 * barang jadi masuk senilai harga pokok standar, jurnal Dr Persediaan barang jadi / Cr Biaya produksi diserap
 * (sama dengan aturan saveProduction bila biaya produksi dikosongkan). Mengembalikan perintah batch.
 */
export async function simpleProductionOps(db: DB, acct: Accounts, p: SimpleProduction) {
  const id = p.existing?.id ?? crypto.randomUUID();
  const number = p.existing?.number ?? (await nextNumber(db, "PRD", p.date));
  const first = p.items.get(p.lines[0]?.itemId ?? "")?.name;
  const batchCode = p.existing?.batchCode || (await nextBatchCode(db, batchPrefixFor(p.category, first), p.date));
  const pos = p.lines.filter((l) => l.qty > 0);
  const values = pos.map((l) => Math.round(l.qty * (p.items.get(l.itemId)?.buyPrice ?? 0)));
  const total = values.reduce((a, v) => a + v, 0);
  const jl: JLine[] = [
    ...pos.map((l, i) => ({ accountId: inventoryAccount(acct, p.items.get(l.itemId)!), debit: values[i], memo: p.items.get(l.itemId)!.name })),
    { accountId: acct.sys("upah_produksi"), credit: total, memo: "Biaya produksi diserap ke persediaan" },
  ];
  const header = {
    number,
    date: p.date,
    laborCost: pos.length ? total : 0,
    note: p.note ?? "",
    category: p.category,
    batchCode,
    leader: p.leader ?? null,
    target: p.target ?? null,
    cementBags: p.cementBags ?? null,
    cementKg: p.cementKg ?? null,
    boards: p.category === "paving" ? (p.boards ?? null) : null,
    rejects: p.rejects,
    gradeB: p.gradeB,
    method: p.method ?? null,
    batchId: p.batchId ?? null,
    mixLogId: p.mixLogId ?? null,
    issues: p.existing ? (Array.isArray(p.existing.issues) ? p.existing.issues : []) : [],
    photoKey: p.existing?.photoKey ?? null,
    ...(p.resetSign || !p.existing ? { rejectManagerBy: null, rejectManagerAt: null, rejectLeaderBy: null, rejectLeaderAt: null } : {}),
    updatedAt: new Date(),
  };
  const ops: (Op | Op[])[] = [
    p.existing
      ? [
          db.update(schema.productions).set(header).where(eq(schema.productions.id, id)),
          db.delete(schema.productionLines).where(eq(schema.productionLines.productionId, id)),
          db.delete(schema.stockMoves).where(and(eq(schema.stockMoves.source, "produksi"), eq(schema.stockMoves.sourceId, id))),
          ...deleteJournalOps(db, "produksi", id),
        ]
      : db.insert(schema.productions).values({ id, ...header, createdBy: p.createdBy }),
    ...insertMany(db, schema.productionLines, p.lines.map((l) => ({ productionId: id, itemId: l.itemId, qty: l.qty, role: "hasil" as const }))),
    ...insertMany(db, schema.stockMoves, pos.map((l, i) => ({ itemId: l.itemId, date: p.date, qty: l.qty, value: values[i], source: "produksi" as const, sourceId: id, note: number }))),
    ...journalOps(db, { number, date: p.date, memo: `Hasil produksi ${number}${p.note ? ` · ${p.note.slice(0, 80)}` : ""}`, source: "produksi", sourceId: id, createdBy: p.createdBy, lines: jl }),
  ];
  return { id, number, batchCode, ops: ops as unknown as Op[] };
}

/** Perintah menghapus satu dokumen produksi beserta baris, pergerakan stok, dan jurnalnya. */
export function deleteProductionOps(db: DB, id: string): Op[] {
  return [
    db.delete(schema.productionLines).where(eq(schema.productionLines.productionId, id)),
    db.delete(schema.stockMoves).where(and(eq(schema.stockMoves.source, "produksi"), eq(schema.stockMoves.sourceId, id))),
    ...deleteJournalOps(db, "produksi", id),
    db.delete(schema.productions).where(eq(schema.productions.id, id)),
  ] as Op[];
}
