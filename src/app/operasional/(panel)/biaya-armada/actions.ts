"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, getEnv, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { can, type Role } from "@/lib/roles";
import { isDate, parseQty, parseRupiah } from "@/lib/erp/util";
import { saveImage, UploadError } from "@/lib/media";
import { logActivity } from "@/lib/ops/activity";
import { pushToUsers } from "@/lib/ops/push";
import {
  APPROVAL_THRESHOLD,
  berkasUrl,
  FLEET_FUND_KEYS,
  FLEET_KIND_BY_KEY,
  FLEET_KIND_KEYS,
  FLEET_PLACES,
  FLEET_START_DATE,
  isIncome,
  isOnOrAfterFleetStart,
  isTempoPayment,
  MAINTENANCE_KINDS,
  MAX_FLEET_PHOTOS,
  placeOf,
  TRIP_COSTS,
  type FleetKind,
} from "@/lib/ops/shared/fleet";

export interface FleetActionResult {
  ok?: string;
  error?: string;
  needsApproval?: boolean;
  count?: number;
  tripRef?: string;
}

export interface FleetPhotoUploadResult {
  key?: string;
  url?: string;
  error?: string;
}

const REVALIDATE_PATHS = [
  "/operasional/biaya-armada",
  "/operasional/dana-cepi",
  "/operasional/piutang-cepi",
] as const;

function revalidateFleet(): void {
  for (const p of REVALIDATE_PATHS) revalidatePath(p);
}

async function requireEditPerm() {
  return requirePerm("keuangan", "pengiriman");
}

async function requireApprovePerm() {
  return requirePerm("keuangan", "laporan", "ttd_pimpinan", "setujui_qc");
}

function str(v: FormDataEntryValue | null | undefined): string {
  return typeof v === "string" ? v.trim() : "";
}

function parseExistingPhotos(raw: string): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .slice(0, MAX_FLEET_PHOTOS);
  } catch {
    return [];
  }
}

async function uploadFormPhotos(formData: FormData, existing: string[]): Promise<string[]> {
  const photos = [...existing].slice(0, MAX_FLEET_PHOTOS);
  const entries = formData.getAll("photos");
  for (const entry of entries) {
    if (photos.length >= MAX_FLEET_PHOTOS) break;
    if (entry instanceof File && entry.size > 0) {
      const key = await saveImage(entry, "armada");
      if (key) photos.push(key);
    }
  }
  return photos;
}

async function notifyFleetApprovers(
  excludeUserId: number,
  title: string,
  body: string,
  tag: string,
): Promise<void> {
  try {
    const db = await getDb();
    const env = await getEnv();
    const users = await db
      .select({ id: schema.users.id, roles: schema.users.roles })
      .from(schema.users);

    const targetIds = users
      .filter((u) => {
        const roles = (Array.isArray(u.roles) ? u.roles : []) as Role[];
        return (
          u.id !== excludeUserId &&
          (can(roles, "keuangan") ||
            can(roles, "laporan") ||
            can(roles, "ttd_pimpinan") ||
            can(roles, "setujui_qc"))
        );
      })
      .map((u) => u.id);

    if (targetIds.length) {
      await pushToUsers(db, env, targetIds, {
        title,
        body,
        url: "/operasional/biaya-armada",
        tag,
      });
    }
  } catch {
    // kegagalan notifikasi tidak menggagalkan penyimpanan transaksi
  }
}

function formatRpSimple(n: number): string {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

async function resolveVehicle(
  db: Awaited<ReturnType<typeof getDb>>,
  vehicleIdRaw: string,
  vehicleLabelRaw: string,
): Promise<{ vehicleId: string | null; vehicleLabel: string }> {
  const vid = vehicleIdRaw && vehicleIdRaw !== "UMUM" ? vehicleIdRaw : "";
  if (vid) {
    const [veh] = await db
      .select({ id: schema.vehicles.id, plate: schema.vehicles.plate, name: schema.vehicles.name })
      .from(schema.vehicles)
      .where(eq(schema.vehicles.id, vid))
      .limit(1);
    if (veh) return { vehicleId: veh.id, vehicleLabel: `${veh.plate} · ${veh.name}` };
  }
  if (vehicleIdRaw === "UMUM") {
    return { vehicleId: null, vehicleLabel: vehicleLabelRaw || "Umum / semua kendaraan" };
  }
  return { vehicleId: null, vehicleLabel: vehicleLabelRaw };
}

/** Unggah satu foto nota armada ke R2 (`armada/...`). */
export async function uploadFleetPhoto(formData: FormData): Promise<FleetPhotoUploadResult> {
  await requireEditPerm();
  try {
    const entry = formData.get("file") ?? formData.get("photo");
    if (!(entry instanceof File) || entry.size <= 0) {
      return { error: "Pilih berkas gambar terlebih dahulu." };
    }
    const key = await saveImage(entry, "armada");
    if (!key) return { error: "Berkas gambar kosong." };
    return { key, url: berkasUrl(key) };
  } catch (err) {
    if (err instanceof UploadError) return { error: err.message };
    return { error: err instanceof Error ? err.message : "Gagal mengunggah foto." };
  }
}

/** Simpan catatan biaya atau pendapatan armada (mendukung baris suku cadang & biaya tambahan servis). */
export async function saveFleetExpense(formData: FormData): Promise<FleetActionResult> {
  const me = await requireEditPerm();

  try {
    const id = str(formData.get("id"));
    const entryDate = str(formData.get("entryDate"));
    const kind = str(formData.get("kind"));
    const subcategory = str(formData.get("subcategory"));
    const vehicleIdRaw = str(formData.get("vehicleId"));
    const vehicleLabelRaw = str(formData.get("vehicleLabel"));
    const driverName = str(formData.get("driverName"));
    const shop = str(formData.get("shop"));
    const mechanic = str(formData.get("mechanic"));
    const placeRaw = str(formData.get("place"));
    const destination = str(formData.get("destination"));
    const payment = str(formData.get("payment")) || "Transfer";
    const fundRaw = str(formData.get("fund")) || "ib";
    const fund = FLEET_FUND_KEYS.includes(fundRaw) ? fundRaw : "ib";
    const note = str(formData.get("note"));
    const party = str(formData.get("party"));
    const dueDate = str(formData.get("dueDate"));

    if (!isDate(entryDate) || !isOnOrAfterFleetStart(entryDate)) {
      return { error: `Tanggal catatan harus valid dan tidak boleh sebelum ${FLEET_START_DATE}.` };
    }
    if (!FLEET_KIND_KEYS.includes(kind as FleetKind)) {
      return { error: "Jenis transaksi armada tidak valid." };
    }

    const income = isIncome(kind);
    const tempo = !income && isTempoPayment(payment);
    if (tempo && !isDate(dueDate)) {
      return { error: "Tanggal jatuh tempo wajib diisi untuk pembayaran Tempo." };
    }

    const place = MAINTENANCE_KINDS.has(kind)
      ? (FLEET_PLACES as readonly string[]).includes(placeRaw)
        ? placeRaw
        : placeOf(kind, placeRaw)
      : placeRaw;

    const db = await getDb();
    const { vehicleId, vehicleLabel } = await resolveVehicle(db, vehicleIdRaw, vehicleLabelRaw);
    if (!vehicleId && !vehicleLabel) {
      return { error: "Pilih kendaraan atau Umum terlebih dahulu." };
    }

    // Kumpulkan baris item (single line, multi-part lines, dan biaya tambahan servis)
    type LineDraft = { kind: string; item: string; qty: number; price: number; total: number };
    const lines: LineDraft[] = [];

    const linesJsonRaw = str(formData.get("linesJson"));
    if (linesJsonRaw) {
      try {
        const parsed = JSON.parse(linesJsonRaw);
        if (Array.isArray(parsed)) {
          for (const l of parsed) {
            const qty = Math.max(0.01, parseQty(String(l?.qty ?? 1)) || 1);
            const price = Math.max(0, parseRupiah(String(l?.price ?? 0)));
            const total = Math.max(0, parseRupiah(String(l?.total ?? 0)) || Math.round(qty * price));
            const item = String(l?.item || "").trim();
            if (total > 0 && item) {
              lines.push({
                kind,
                item,
                qty,
                price: price || Math.round(total / qty),
                total,
              });
            }
          }
        }
      } catch {
        return { error: "Format rincian barang tidak valid." };
      }
    } else {
      const itemInput = str(formData.get("item"));
      const qty = Math.max(0.01, parseQty(str(formData.get("qty")) || "1") || 1);
      const price = Math.max(0, parseRupiah(str(formData.get("price"))));
      const totalInput = Math.max(0, parseRupiah(str(formData.get("total"))));
      const total = totalInput || Math.round(qty * price);
      const kindInfo = FLEET_KIND_BY_KEY[kind as FleetKind];
      const item = itemInput || subcategory || kindInfo?.label || kind;
      if (total > 0) {
        lines.push({
          kind,
          item,
          qty,
          price: price || Math.round(total / qty),
          total,
        });
      }
    }

    const extrasJsonRaw = str(formData.get("extrasJson"));
    if (extrasJsonRaw && !id) {
      try {
        const parsed = JSON.parse(extrasJsonRaw);
        if (Array.isArray(parsed)) {
          for (const ex of parsed) {
            const amt = Math.max(0, parseRupiah(String(ex?.total ?? 0)));
            const lbl = String(ex?.label || "Biaya tambahan servis").trim();
            if (amt > 0) {
              lines.push({
                kind: "tambahan",
                item: lbl,
                qty: 1,
                price: amt,
                total: amt,
              });
            }
          }
        }
      } catch {
        return { error: "Format biaya tambahan servis tidak valid." };
      }
    }

    if (!lines.length) {
      return { error: "Isi rincian & nominal lebih dari Rp 0." };
    }

    const existingPhotos = parseExistingPhotos(str(formData.get("existingPhotosJson")));
    const photoKeys = await uploadFormPhotos(formData, existingPhotos);

    const groupTotal = lines.reduce((sum, l) => sum + l.total, 0);
    const overLimit = !income && groupTotal > APPROVAL_THRESHOLD;
    const approvalStatus = overLimit ? "menunggu" : "ok";

    if (id) {
      const [existingRow] = await db
        .select()
        .from(schema.fleetExpenses)
        .where(eq(schema.fleetExpenses.id, id))
        .limit(1);
      if (!existingRow) return { error: "Catatan tidak ditemukan." };

      const first = lines[0];
      const keepApproved =
        existingRow.approvalStatus === "disetujui" && groupTotal <= existingRow.total && !overLimit;
      const nextStatus = keepApproved ? "disetujui" : approvalStatus;

      await db
        .update(schema.fleetExpenses)
        .set({
          entryDate,
          vehicleId,
          vehicleLabel,
          driverName,
          kind: first.kind,
          subcategory,
          item: first.item,
          qty: first.qty,
          price: first.price,
          total: first.total,
          shop,
          mechanic,
          place,
          destination,
          payment,
          fund,
          note,
          party,
          dueDate: tempo ? dueDate : "",
          tempoPaidAt: tempo ? existingRow.tempoPaidAt : null,
          tempoPaidByName: tempo ? existingRow.tempoPaidByName : "",
          photoKeys,
          approvalStatus: nextStatus,
          ...(nextStatus === "menunggu"
            ? { approvedBy: null, approvedByName: "", approvedAt: null, approvalNote: "" }
            : {}),
          updatedByName: me.name,
          updatedAt: new Date(),
        })
        .where(eq(schema.fleetExpenses.id, id));

      for (const extra of lines.slice(1)) {
        await db.insert(schema.fleetExpenses).values({
          id: crypto.randomUUID(),
          entryDate,
          vehicleId,
          vehicleLabel,
          driverName,
          kind: extra.kind,
          subcategory,
          item: extra.item,
          qty: extra.qty,
          price: extra.price,
          total: extra.total,
          shop,
          mechanic,
          place,
          destination,
          payment,
          fund,
          note,
          party,
          dueDate: tempo ? dueDate : "",
          photoKeys,
          approvalStatus,
          createdBy: me.id,
          createdByName: me.name,
          updatedByName: me.name,
        });
      }
    } else {
      for (const line of lines) {
        await db.insert(schema.fleetExpenses).values({
          id: crypto.randomUUID(),
          entryDate,
          vehicleId,
          vehicleLabel,
          driverName,
          kind: line.kind,
          subcategory,
          item: line.item,
          qty: line.qty,
          price: line.price,
          total: line.total,
          shop,
          mechanic,
          place,
          destination,
          payment,
          fund,
          note,
          party,
          dueDate: tempo ? dueDate : "",
          photoKeys,
          approvalStatus,
          createdBy: me.id,
          createdByName: me.name,
          updatedByName: me.name,
        });
      }
    }

    if (overLimit) {
      await notifyFleetApprovers(
        me.id,
        "Butuh ACC Biaya Armada",
        `${me.name} mencatat ${vehicleLabel} sebesar ${formatRpSimple(groupTotal)} (> Rp 3 jt).`,
        `fleet-acc-${entryDate}`,
      );
    }

    await logActivity(me, {
      action: id ? "armada.ubah" : "armada.catat",
      label: id ? "Mengubah catatan armada" : "Mencatat biaya/pendapatan armada",
      summary: `${vehicleLabel} · ${lines[0].item} · ${formatRpSimple(groupTotal)}`,
      details: { id: id || null, entryDate, kind, vehicleLabel, count: lines.length, groupTotal, overLimit },
    });

    revalidateFleet();
    return {
      ok: overLimit
        ? `Tersimpan (${lines.length} baris). Nominal di atas Rp 3.000.000 menunggu ACC pimpinan/keuangan.`
        : `Berhasil menyimpan ${lines.length} catatan.`,
      needsApproval: overLimit,
      count: lines.length,
    };
  } catch (err) {
    if (err instanceof UploadError) return { error: err.message };
    return { error: err instanceof Error ? err.message : "Gagal menyimpan catatan armada." };
  }
}

/** Hapus satu catatan biaya/pendapatan armada. */
export async function deleteFleetExpense(id: string): Promise<FleetActionResult> {
  const me = await requireEditPerm();
  try {
    if (!id) return { error: "ID catatan tidak valid." };
    const db = await getDb();
    const [existing] = await db
      .select()
      .from(schema.fleetExpenses)
      .where(eq(schema.fleetExpenses.id, id))
      .limit(1);
    if (!existing) return { error: "Catatan sudah tidak ada." };

    await db.delete(schema.fleetExpenses).where(eq(schema.fleetExpenses.id, id));
    await logActivity(me, {
      action: "armada.hapus",
      label: "Menghapus catatan armada",
      summary: `${existing.vehicleLabel || "Armada"} · ${existing.item} · ${formatRpSimple(existing.total)}`,
      details: { id, entryDate: existing.entryDate, total: existing.total },
    });

    revalidateFleet();
    return { ok: "Catatan berhasil dihapus." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal menghapus catatan." };
  }
}

/** Setujui atau tolak catatan armada bernominal > Rp 3.000.000. */
export async function approveFleetExpense(input: {
  id: string;
  decision: "disetujui" | "ditolak";
  note?: string;
}): Promise<FleetActionResult> {
  const me = await requireApprovePerm();
  try {
    const id = String(input.id || "").trim();
    const decision = input.decision;
    const note = String(input.note || "").trim();
    if (!id) return { error: "ID catatan tidak valid." };
    if (decision !== "disetujui" && decision !== "ditolak") return { error: "Keputusan tidak valid." };
    if (decision === "ditolak" && !note) return { error: "Alasan penolakan wajib diisi." };

    const db = await getDb();
    const [row] = await db
      .select()
      .from(schema.fleetExpenses)
      .where(eq(schema.fleetExpenses.id, id))
      .limit(1);
    if (!row) return { error: "Catatan tidak ditemukan." };

    await db
      .update(schema.fleetExpenses)
      .set({
        approvalStatus: decision,
        approvedBy: me.id,
        approvedByName: me.name,
        approvedAt: new Date(),
        approvalNote: note,
        updatedByName: me.name,
        updatedAt: new Date(),
      })
      .where(eq(schema.fleetExpenses.id, id));

    if (row.createdBy && row.createdBy !== me.id) {
      try {
        const env = await getEnv();
        await pushToUsers(db, env, [row.createdBy], {
          title: decision === "disetujui" ? "Biaya Armada Disetujui" : "Biaya Armada Ditolak",
          body: `${row.item} (${formatRpSimple(row.total)}) ${decision} oleh ${me.name}${note ? `: ${note}` : ""}`,
          url: "/operasional/biaya-armada",
          tag: `fleet-acc-res-${id}`,
        });
      } catch {
        // abaikan error push
      }
    }

    await logActivity(me, {
      action: `armada.${decision}`,
      label: decision === "disetujui" ? "Menyetujui biaya armada" : "Menolak biaya armada",
      summary: `${row.vehicleLabel} · ${row.item} · ${formatRpSimple(row.total)}`,
      details: { id, decision, note },
    });

    revalidateFleet();
    return { ok: decision === "disetujui" ? "Catatan disetujui." : "Catatan ditolak." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal memproses persetujuan." };
  }
}

/** Tandai tagihan tempo lunas (atau batal lunas) untuk satu baris atau satu perjalanan (`tripRef`). */
export async function markTempoPaid(input: {
  id?: string | null;
  tripRef?: string;
  paid?: boolean;
  method?: "tunai" | "transfer" | string;
}): Promise<FleetActionResult> {
  const me = await requireEditPerm();
  try {
    const id = input.id ? String(input.id).trim() : "";
    const tripRef = input.tripRef ? String(input.tripRef).trim() : "";
    if (!id && !tripRef) return { error: "Target tempo tidak ditemukan." };

    const paid = input.paid !== false;
    const methodRaw = String(input.method || "transfer").trim();
    const nextPayment =
      methodRaw.toLowerCase() === "transfer"
        ? "Transfer"
        : methodRaw.toLowerCase() === "tunai"
          ? "Tunai"
          : methodRaw;

    const db = await getDb();
    const whereClause = tripRef
      ? eq(schema.fleetExpenses.tripRef, tripRef)
      : eq(schema.fleetExpenses.id, id);

    const existingRows = await db.select().from(schema.fleetExpenses).where(whereClause);
    if (!existingRows.length) return { error: "Catatan tempo tidak ditemukan." };

    if (paid) {
      await db
        .update(schema.fleetExpenses)
        .set({
          tempoPaidAt: new Date(),
          tempoPaidByName: me.name,
          payment: nextPayment,
          updatedByName: me.name,
          updatedAt: new Date(),
        })
        .where(whereClause);
    } else {
      await db
        .update(schema.fleetExpenses)
        .set({
          tempoPaidAt: null,
          tempoPaidByName: "",
          payment: "Tempo",
          updatedByName: me.name,
          updatedAt: new Date(),
        })
        .where(whereClause);
    }

    const total = existingRows.reduce((s, r) => s + Number(r.total || 0), 0);
    await logActivity(me, {
      action: paid ? "armada.tempo_lunas" : "armada.tempo_batal",
      label: paid ? "Melunasi tagihan tempo armada" : "Membatalkan status lunas tempo armada",
      summary: `${tripRef || existingRows[0].item} · ${formatRpSimple(total)} · ${paid ? nextPayment : "Tempo"}`,
      details: { id: id || null, tripRef: tripRef || null, paid, payment: paid ? nextPayment : "Tempo", total },
    });

    revalidateFleet();
    return {
      ok: paid ? `Tagihan tempo ditandai lunas (${nextPayment}).` : "Status lunas dibatalkan.",
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal memperbarui status tempo." };
  }
}

/** Simpan atau perbarui beberapa komponen biaya perjalanan dalam satu `tripRef`. */
export async function saveFleetTrip(formData: FormData): Promise<FleetActionResult> {
  const me = await requireEditPerm();
  try {
    const existingRef = str(formData.get("tripRef"));
    const entryDate = str(formData.get("entryDate"));
    const vehicleIdRaw = str(formData.get("vehicleId"));
    const vehicleLabelRaw = str(formData.get("vehicleLabel"));
    const driverName = str(formData.get("driverName"));
    const destination = str(formData.get("destination"));
    const payment = str(formData.get("payment")) || "Cash (Cepi)";
    const fundRaw = str(formData.get("fund")) || "cepi";
    const fund = FLEET_FUND_KEYS.includes(fundRaw) ? fundRaw : "cepi";
    const dueDate = str(formData.get("dueDate"));
    const note = str(formData.get("note"));

    if (!isDate(entryDate) || !isOnOrAfterFleetStart(entryDate)) {
      return { error: `Tanggal perjalanan harus valid dan tidak boleh sebelum ${FLEET_START_DATE}.` };
    }

    const tempo = isTempoPayment(payment);
    if (tempo && !isDate(dueDate)) {
      return { error: "Tanggal jatuh tempo wajib diisi untuk pembayaran Tempo." };
    }

    let costsObj: Record<string, number> = {};
    const costsJson = str(formData.get("costsJson"));
    if (costsJson) {
      try {
        costsObj = JSON.parse(costsJson) as Record<string, number>;
      } catch {
        return { error: "Format rincian biaya perjalanan tidak valid." };
      }
    }

    const activeCosts = TRIP_COSTS.map((c) => ({
      key: c.key,
      label: c.label,
      total: Math.max(0, parseRupiah(String(costsObj[c.key] ?? 0))),
    })).filter((c) => c.total > 0);

    if (!activeCosts.length) {
      return { error: "Isi minimal satu komponen biaya perjalanan (> Rp 0)." };
    }

    const db = await getDb();
    const { vehicleId, vehicleLabel } = await resolveVehicle(db, vehicleIdRaw, vehicleLabelRaw);
    if (!vehicleId && !vehicleLabel) {
      return { error: "Pilih kendaraan terlebih dahulu." };
    }

    const existingPhotos = parseExistingPhotos(str(formData.get("existingPhotosJson")));
    const photoKeys = await uploadFormPhotos(formData, existingPhotos);

    const tripRef = existingRef || `TRIP-${entryDate}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const groupTotal = activeCosts.reduce((s, c) => s + c.total, 0);
    const overLimit = groupTotal > APPROVAL_THRESHOLD;
    const approvalStatus = overLimit ? "menunggu" : "ok";

    let prevPaidAt: Date | null = null;
    let prevPaidBy = "";
    if (existingRef) {
      const oldRows = await db
        .select()
        .from(schema.fleetExpenses)
        .where(eq(schema.fleetExpenses.tripRef, existingRef));
      if (oldRows.length) {
        prevPaidAt = oldRows[0].tempoPaidAt ?? null;
        prevPaidBy = oldRows[0].tempoPaidByName ?? "";
      }
      await db.delete(schema.fleetExpenses).where(eq(schema.fleetExpenses.tripRef, existingRef));
    }

    for (const c of activeCosts) {
      await db.insert(schema.fleetExpenses).values({
        id: crypto.randomUUID(),
        entryDate,
        vehicleId,
        vehicleLabel,
        driverName,
        kind: c.key,
        subcategory: c.label,
        item: destination ? `${c.label} (${destination})` : c.label,
        qty: 1,
        price: c.total,
        total: c.total,
        shop: "",
        mechanic: "",
        place: "",
        destination,
        payment,
        fund,
        note,
        party: driverName,
        tripRef,
        dueDate: tempo ? dueDate : "",
        tempoPaidAt: tempo ? prevPaidAt : null,
        tempoPaidByName: tempo ? prevPaidBy : "",
        photoKeys,
        approvalStatus,
        createdBy: me.id,
        createdByName: me.name,
        updatedByName: me.name,
      });
    }

    if (overLimit) {
      await notifyFleetApprovers(
        me.id,
        "Butuh ACC Biaya Perjalanan",
        `${me.name} mencatat perjalanan ${vehicleLabel} (${destination || "-"}) sebesar ${formatRpSimple(groupTotal)}.`,
        `fleet-trip-${tripRef}`,
      );
    }

    await logActivity(me, {
      action: existingRef ? "armada.trip_ubah" : "armada.trip_simpan",
      label: existingRef ? "Mengubah biaya perjalanan armada" : "Mencatat biaya perjalanan armada",
      summary: `${vehicleLabel} · ${destination || tripRef} · ${formatRpSimple(groupTotal)}`,
      details: { tripRef, entryDate, vehicleLabel, destination, count: activeCosts.length, groupTotal },
    });

    revalidateFleet();
    return {
      ok: overLimit
        ? `Perjalanan tersimpan (${activeCosts.length} pos). Menunggu ACC karena total > Rp 3.000.000.`
        : `Perjalanan tersimpan (${activeCosts.length} pos).`,
      needsApproval: overLimit,
      count: activeCosts.length,
      tripRef,
    };
  } catch (err) {
    if (err instanceof UploadError) return { error: err.message };
    return { error: err instanceof Error ? err.message : "Gagal menyimpan perjalanan armada." };
  }
}

/** Hapus semua baris biaya yang tergabung dalam satu `tripRef`. */
export async function deleteFleetTrip(tripRef: string): Promise<FleetActionResult> {
  const me = await requireEditPerm();
  try {
    const ref = String(tripRef || "").trim();
    if (!ref) return { error: "Referensi perjalanan tidak valid." };
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.fleetExpenses)
      .where(eq(schema.fleetExpenses.tripRef, ref));
    if (!rows.length) return { error: "Perjalanan tidak ditemukan." };

    const total = rows.reduce((s, r) => s + Number(r.total || 0), 0);
    await db.delete(schema.fleetExpenses).where(eq(schema.fleetExpenses.tripRef, ref));

    await logActivity(me, {
      action: "armada.trip_hapus",
      label: "Menghapus biaya perjalanan armada",
      summary: `${rows[0].vehicleLabel || "Armada"} · ${rows[0].destination || ref} · ${formatRpSimple(total)}`,
      details: { tripRef: ref, count: rows.length, total },
    });

    revalidateFleet();
    return { ok: "Data perjalanan dihapus." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal menghapus perjalanan." };
  }
}
