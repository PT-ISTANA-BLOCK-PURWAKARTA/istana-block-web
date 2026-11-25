"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { logActivity } from "@/lib/ops/activity";
import { isIncomeLine, parseDeductionLine, parseEarningLine, productionPay, type PayGroup, type PayKind } from "@/lib/ops/payslip";
import { can } from "@/lib/roles";

export type SavePayslipInput = {
  id?: string;
  employeeName: string;
  slipDate: string;
  payKind?: PayKind | "" | null;
  periodFrom?: string | null;
  periodTo?: string | null;
  earnings: { quantity: number; description: string; rate: number }[];
  deductions: { description: string; amount: number }[];
  kasbonNote?: string | null;
  note?: string | null;
  signerId?: number | null;
  signerName?: string | null;
};

/** "1000000|GENTENG" per baris -> [{ amount, description }] */
function baris(teks: string) {
  return teks
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [a, ...d] = l.split("|");
      return { amount: Number(a.replace(/[^\d.-]/g, "")) || 0, description: d.join("|").trim() };
    });
}

async function pastikanBoleh() {
  const { user } = await opsAccess();
  if (!can(user.roles, "keuangan")) throw new Error("Tidak berhak mengelola gaji.");
  return user;
}

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function savePayslipAction(
  input: SavePayslipInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const user = await pastikanBoleh();
    const employeeName = String(input.employeeName ?? "").trim();
    if (employeeName.length < 2 || employeeName.length > 120) {
      return { ok: false, error: "Nama karyawan / grup wajib diisi (2–120 huruf)." };
    }
    const slipDate = String(input.slipDate ?? "").trim();
    if (!isDate(slipDate)) {
      return { ok: false, error: "Tanggal gajian tidak valid." };
    }
    const payKind = input.payKind === "mingguan" || input.payKind === "bulanan" ? input.payKind : null;
    const periodFrom = payKind && isDate(input.periodFrom) ? input.periodFrom : null;
    const periodTo = payKind && isDate(input.periodTo) ? input.periodTo : null;
    if (payKind && (!periodFrom || !periodTo || periodFrom > periodTo)) {
      return { ok: false, error: "Rentang periode gaji tidak valid." };
    }

    const earnings = (input.earnings ?? [])
      .map((row) => parseEarningLine(row as unknown as Record<string, unknown>))
      .filter((row) => isIncomeLine(row))
      .map((row) => ({
        quantity: row.quantity,
        description: row.description.slice(0, 200),
        rate: row.rate,
        amount: Math.round(row.quantity * row.rate),
      }));
    if (!earnings.length) {
      return { ok: false, error: "Isi minimal satu baris pendapatan." };
    }

    const deductions = (input.deductions ?? [])
      .map((row) => parseDeductionLine(row as unknown as Record<string, unknown>))
      .filter((row) => Boolean(row.description) || row.amount !== 0)
      .map((row) => ({
        description: row.description.slice(0, 200),
        amount: Math.round(row.amount),
      }));

    const db = await getDb();
    let signerId = typeof input.signerId === "number" && Number.isFinite(input.signerId) ? input.signerId : null;
    let signerName = String(input.signerName ?? "").trim().slice(0, 120) || null;
    if (signerId !== null) {
      const [signer] = await db
        .select({ id: schema.users.id, name: schema.users.name })
        .from(schema.users)
        .where(eq(schema.users.id, signerId))
        .limit(1);
      if (signer) {
        signerName = signer.name;
      } else {
        signerId = null;
      }
    }

    const payload = {
      employeeName,
      slipDate,
      payKind,
      periodFrom,
      periodTo,
      earnings,
      deductions,
      kasbonNote: String(input.kasbonNote ?? "").trim().slice(0, 500) || null,
      note: String(input.note ?? "").trim().slice(0, 500) || null,
      signerId,
      signerName,
    };

    const existingId = String(input.id ?? "").trim();
    if (existingId) {
      const [found] = await db
        .select({ id: schema.payslips.id })
        .from(schema.payslips)
        .where(eq(schema.payslips.id, existingId))
        .limit(1);
      if (!found) return { ok: false, error: "Slip gaji tidak ditemukan." };
      await db
        .update(schema.payslips)
        .set({ ...payload, updatedAt: new Date() })
        .where(eq(schema.payslips.id, existingId));
      await logActivity(user, {
        action: "gaji.ubah",
        label: "Mengubah slip gaji",
        summary: `${employeeName} · ${slipDate}`,
      });
      revalidatePath("/akuntansi/gaji");
      return { ok: true, id: existingId };
    }

    const id = crypto.randomUUID();
    await db.insert(schema.payslips).values({
      id,
      ...payload,
      createdBy: user.id,
    });
    await logActivity(user, {
      action: "gaji.buat",
      label: "Membuat slip gaji",
      summary: `${employeeName} · ${slipDate}`,
    });
    revalidatePath("/akuntansi/gaji");
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal menyimpan slip gaji." };
  }
}

export async function deletePayslipAction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await pastikanBoleh();
    const targetId = String(id ?? "").trim();
    if (!targetId) return { ok: false, error: "ID slip tidak valid." };
    const db = await getDb();
    const [existing] = await db
      .select({ id: schema.payslips.id, employeeName: schema.payslips.employeeName, slipDate: schema.payslips.slipDate })
      .from(schema.payslips)
      .where(eq(schema.payslips.id, targetId))
      .limit(1);
    if (!existing) return { ok: false, error: "Slip gaji tidak ditemukan." };
    await db.delete(schema.payslips).where(eq(schema.payslips.id, targetId));
    await logActivity(user, {
      action: "gaji.hapus",
      label: "Menghapus slip gaji",
      summary: `${existing.employeeName} · ${existing.slipDate}`,
    });
    revalidatePath("/akuntansi/gaji");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal menghapus slip gaji." };
  }
}

export async function loadProductionPayAction(
  from: string,
  to: string,
): Promise<{ ok: true; groups: PayGroup[] } | { ok: false; error: string }> {
  try {
    await pastikanBoleh();
    if (!isDate(from) || !isDate(to) || from > to) {
      return { ok: false, error: "Periode produksi tidak valid." };
    }
    const db = await getDb();
    const groups = await productionPay(db, { from, to });
    return { ok: true, groups };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal memuat hasil produksi." };
  }
}

export async function buatPayslip(fd: FormData) {
  const user = await pastikanBoleh();
  const karyawan = String(fd.get("karyawan") || "").trim();
  const tanggal = String(fd.get("tanggal") || "").trim();
  if (!karyawan || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) throw new Error("Nama dan tanggal wajib diisi.");
  const db = await getDb();
  await db.insert(schema.payslips).values({
    employeeName: karyawan,
    slipDate: tanggal,
    earnings: baris(String(fd.get("pendapatan") || "")),
    deductions: baris(String(fd.get("potongan") || "")),
    kasbonNote: String(fd.get("kasbon") || "").trim() || null,
    signerName: String(fd.get("penandaTangan") || "").trim() || null,
    createdBy: user.id,
  });
  revalidatePath("/akuntansi/gaji");
}

export async function hapusPayslip(fd: FormData) {
  await pastikanBoleh();
  const id = String(fd.get("id") || "");
  if (!id) return;
  const db = await getDb();
  await db.delete(schema.payslips).where(eq(schema.payslips.id, id));
  revalidatePath("/akuntansi/gaji");
}
