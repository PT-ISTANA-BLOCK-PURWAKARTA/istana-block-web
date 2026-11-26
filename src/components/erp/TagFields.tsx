"use client";

// Pilihan Proyek & Departemen (opsional) untuk form transaksi; dikirim sebagai projectId / departmentId.
import { Select } from "@/components/ui";

export type TagOptions = { projects: { value: string; label: string }[]; departments: { value: string; label: string }[]; projectId?: string | null; departmentId?: string | null };

export function TagFields({ tags, idPrefix }: { tags?: TagOptions; idPrefix: string }) {
  if (!tags || (!tags.projects.length && !tags.departments.length)) return null;
  return (
    <>
      {tags.projects.length > 0 && (
        <div className="field"><label htmlFor={`${idPrefix}-proj`}>Proyek <span className="help">opsional</span></label>
          <Select id={`${idPrefix}-proj`} name="projectId" defaultValue={tags.projectId ?? ""} searchable options={[{ value: "", label: "(tanpa proyek)" }, ...tags.projects]} />
        </div>
      )}
      {tags.departments.length > 0 && (
        <div className="field"><label htmlFor={`${idPrefix}-dept`}>Departemen <span className="help">opsional</span></label>
          <Select id={`${idPrefix}-dept`} name="departmentId" defaultValue={tags.departmentId ?? ""} options={[{ value: "", label: "(tanpa departemen)" }, ...tags.departments]} />
        </div>
      )}
    </>
  );
}
