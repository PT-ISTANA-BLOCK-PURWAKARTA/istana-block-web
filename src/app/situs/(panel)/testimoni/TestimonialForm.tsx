"use client";

import Link from "next/link";
import type { Testimonial } from "@/db/schema";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { saveTestimonial } from "../../actions/testimonials";
import { Select, Switch } from "@/components/ui";

export function TestimonialForm({ t }: { t?: Testimonial }) {
  return (
    <ActionForm action={saveTestimonial} className="stack" style={{ gap: 20 }}>
      {t && <input type="hidden" name="id" value={t.id} />}
      <section className="form-section">
        <p className="help">Gunakan ulasan asli pelanggan (misalnya dari Google Maps) dan minta izin bila menampilkan nama lengkap.</p>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="name">Nama pelanggan</label>
            <input id="name" name="name" defaultValue={t?.name} required />
          </div>
          <div className="field">
            <label htmlFor="context">Keterangan <span className="help">contoh: Kontraktor, Karawang · Mei 2026</span></label>
            <input id="context" name="context" defaultValue={t?.context} />
          </div>
          <div className="field full">
            <label htmlFor="quote">Kutipan ulasan</label>
            <textarea id="quote" name="quote" rows={4} defaultValue={t?.quote} required />
          </div>
          <div className="field">
            <label htmlFor="rating">Rating</label>
            <Select id="rating" name="rating" defaultValue={String(t?.rating ?? 5)} options={[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${"★".repeat(n)}${"☆".repeat(5 - n)}  ${n} bintang` }))} />
          </div>
          <div className="field">
            <label htmlFor="sortOrder">Urutan tampil</label>
            <input id="sortOrder" name="sortOrder" type="number" min={0} defaultValue={t?.sortOrder ?? 0} />
          </div>
          <Switch name="published" defaultChecked={t?.published ?? true} label="Tampilkan di situs" />
        </div>
      </section>
      <div className="form-actions">
        <SubmitButton>{t ? "Simpan perubahan" : "Tambah testimoni"}</SubmitButton>
        <Link href="/situs/testimoni" className="btn btn-ghost">Batal</Link>
      </div>
    </ActionForm>
  );
}
