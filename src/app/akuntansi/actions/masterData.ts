"use server";

// Simpan / hapus data induk: satuan, pajak, departemen, proyek.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb, schema } from "@/db";
import { projectStatuses } from "@/db/erp";
import { requireModule } from "@/lib/auth";
import { isMasterKind, MASTER, type MasterKind } from "@/lib/erp/masterData";
import { guard, UserError } from "@/lib/erp/server";
import { isDate, parseRupiah } from "@/lib/erp/util";

const TABLE = { satuan: schema.units, pajak: schema.taxes, departemen: schema.departments, proyek: schema.projects } as const;

export async function saveMaster(_prev: FormState, form: FormData): Promise<FormState> {
  await requireModule("keuangan");
  const kind = String(form.get("kind"));
  if (!isMasterKind(kind)) return { error: "Jenis data tidak dikenal." };
  const res = await guard(async () => {
    const db = await getDb();
    const id = String(form.get("id") ?? "");
    const v: Record<string, unknown> = {};
    for (const f of MASTER[kind].fields) {
      const raw = String(form.get(f.name) ?? "").trim();
      if (f.required && !raw && f.type !== "check") throw new UserError(`Isi ${f.label.toLowerCase()}.`);
      if (f.type === "check") v[f.name] = form.get(f.name) === "on";
      else if (f.type === "number") v[f.name] = Number(raw.replace(",", ".")) || 0;
      else if (f.type === "money") v[f.name] = parseRupiah(raw) || 0;
      else if (f.type === "date") { if (raw && !isDate(raw)) throw new UserError(`${f.label} tidak valid.`); v[f.name] = raw || null; }
      else if (f.type === "select") v[f.name] = raw || null;
      else v[f.name] = raw.slice(0, 300);
    }
    if (kind === "proyek" && !projectStatuses.includes(v.status as never)) v.status = "aktif";
    const table = TABLE[kind as MasterKind];
    const clash = await db.select({ id: table.id }).from(table).where(id ? and(eq(table.code, String(v.code)), ne(table.id, id)) : eq(table.code, String(v.code))).limit(1);
    if (clash.length) throw new UserError(`Kode ${v.code} sudah dipakai.`);
    if (id) await db.update(table).set({ ...v, updatedAt: new Date() } as never).where(eq(table.id, id));
    else await db.insert(table).values(v as never);
    return { code: String(v.code) };
  });
  if ("error" in res) return res;
  redirect(`/akuntansi/data/${kind}?ok=${encodeURIComponent(res.code)}`);
}

export async function deleteMaster(kind: string, id: string): Promise<{ ok?: string; error?: string }> {
  await requireModule("keuangan");
  if (!isMasterKind(kind)) return { error: "Jenis data tidak dikenal." };
  const res = await guard(async () => {
    const db = await getDb();
    if (kind === "proyek" || kind === "departemen") {
      const col = kind === "proyek" ? sql`project_id` : sql`department_id`;
      const used = await db.get<{ n: number }>(sql`select count(*) n from fin_journal_lines where ${col} = ${id}`);
      if (Number(used?.n ?? 0) > 0) throw new UserError("Sudah dipakai di transaksi. Nonaktifkan saja (hapus centang Aktif).");
    }
    const table = TABLE[kind];
    await db.delete(table).where(eq(table.id, id));
    return { ok: "Dihapus." };
  });
  revalidatePath(`/akuntansi/data/${kind}`);
  return res;
}
