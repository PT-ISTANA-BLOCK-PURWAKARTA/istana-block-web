import "server-only";
import { and, eq } from "drizzle-orm";
import { schema } from "@/db";
import { assertOpen, getFinSettings, isStockItem, loadAccounts, runBatch, UserError, type DB } from "@/lib/erp/server";
import { HALF_RE, matchFinishedItem, matchHalfHexagon } from "@/lib/ops/production";
import { deleteProductionOps, simpleProductionOps } from "@/lib/ops/production-post";

const MAT_UNIT = /^m[²2]$/i;

/** Semen curah (kg) dari bahan actual catatan mix: baris "semen" berstuan kg (sak dianggap 50 kg). */
function cementKgOf(materials: { name: string; qty: number | null; unit: string }[]) {
  let kg = 0;
  for (const m of materials) {
    if (!/semen/i.test(m.name) || !m.qty) continue;
    const u = m.unit.trim().toLowerCase();
    kg += u === "sak" ? m.qty * 50 : u === "kg" ? m.qty : 0;
  }
  return kg > 0 ? kg : null;
}

/**
 * Menyelaraskan baris Hasil Produksi paving dengan satu catatan Mix Desain harian (lapisan badan):
 * m2 Grade A -> hasil (memposting stok), Grade B & reject dicatat, belahan Hexagon -> barang "Hexagon Setengah".
 * Baris ditandai mix_log_id. Catatan dihapus / bukan badan / tidak ada hasil / barang tidak cocok / periode tertutup =
 * baris otomatisnya dihapus (periode tertutup: dibiarkan). Dipanggil setelah catatan disimpan atau dihapus; tidak melempar.
 */
export async function syncMixProduction(db: DB, logId: string) {
  try {
    const [log, existing] = await Promise.all([
      db.query.mixLogs.findFirst({ where: eq(schema.mixLogs.id, logId) }),
      db.query.productions.findFirst({ where: eq(schema.productions.mixLogId, logId) }),
    ]);
    const fin = await getFinSettings(db);
    if (existing) assertOpen(existing.date, fin.lockDate, "Produksi");
    const has = log && log.layer === "badan" && ((log.squareMeters ?? 0) > 0 || (log.gradeB ?? 0) > 0 || (log.rejects ?? 0) > 0 || (log.halfPieces ?? 0) > 0);
    if (!log || !has) {
      if (existing) await runBatch(db, deleteProductionOps(db, existing.id));
      return;
    }
    assertOpen(log.workDate, fin.lockDate, "Produksi");
    const finished = (await db.select().from(schema.items).where(and(eq(schema.items.kind, "barang_jadi"), eq(schema.items.active, true)))).filter(isStockItem);
    const main = matchFinishedItem(log.product, finished.filter((i) => !HALF_RE.test(i.name) && MAT_UNIT.test(i.unit.trim())));
    const half = (log.halfPieces ?? 0) > 0 ? matchHalfHexagon(log.product, finished) : null;
    if (!main) {
      if (existing) await runBatch(db, deleteProductionOps(db, existing.id));
      return;
    }
    const lines = [{ itemId: main.id, qty: log.squareMeters ?? 0 }, ...(half && (log.halfPieces ?? 0) > 0 ? [{ itemId: half.id, qty: log.halfPieces ?? 0 }] : [])];
    const items = new Map([main, ...(half ? [half] : [])].map((i) => [i.id, i]));
    const oldQty = existing ? await db.select({ qty: schema.productionLines.qty }).from(schema.productionLines).where(eq(schema.productionLines.productionId, existing.id)) : [];
    const changed = !!existing && (existing.gradeB !== (log.gradeB ?? null) || existing.rejects !== (log.rejects ?? null) || oldQty.reduce((a, l) => a + l.qty, 0) !== lines.reduce((a, l) => a + l.qty, 0));
    const r = await simpleProductionOps(db, await loadAccounts(db), {
      existing,
      date: log.workDate,
      category: "paving",
      lines,
      items,
      gradeB: log.gradeB ?? null,
      rejects: log.rejects ?? null,
      boards: log.boards ?? null,
      note: "Otomatis dari Mix Desain harian",
      cementKg: cementKgOf(log.actualMaterials ?? []),
      mixLogId: log.id,
      resetSign: changed,
      createdBy: log.createdBy ?? null,
    });
    await runBatch(db, r.ops);
  } catch (e) {
    // Catatan mix desain tetap tersimpan walau baris produksinya gagal diselaraskan (mis. periode tertutup).
    if (!(e instanceof UserError)) console.error("syncMixProduction", e);
  }
}
