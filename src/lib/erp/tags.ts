import "server-only";
// Pilihan proyek/departemen untuk form transaksi (+ nilai tersimpan dari baris jurnal dokumen yang diubah).
import { sql } from "drizzle-orm";
import type { TagOptions } from "@/components/erp/TagFields";
import type { DB } from "./server";

export async function loadTags(db: DB, journal?: { source: string; sourceId: string }): Promise<TagOptions> {
  const [projects, departments, cur] = await Promise.all([
    db.all<{ id: string; code: string; name: string }>(sql`select id, code, name from fin_projects where active = 1 and status = 'aktif' order by code`),
    db.all<{ id: string; code: string; name: string }>(sql`select id, code, name from fin_departments where active = 1 order by code`),
    journal
      ? db.get<{ p: string | null; d: string | null }>(sql`select max(l.project_id) p, max(l.department_id) d from fin_journal_lines l join fin_journals j on j.id = l.journal_id where j.source = ${journal.source} and j.source_id = ${journal.sourceId}`)
      : Promise.resolve(undefined),
  ]);
  return {
    projects: projects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` })),
    departments: departments.map((d) => ({ value: d.id, label: `${d.code} · ${d.name}` })),
    projectId: cur?.p ?? null,
    departmentId: cur?.d ?? null,
  };
}
