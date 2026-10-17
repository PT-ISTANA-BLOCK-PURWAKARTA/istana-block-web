"use client";

import Link from "next/link";
import { PAGE_KIND_LABEL, pageKinds, type Page } from "@/db/schema";
import { ActionForm } from "@/components/admin/ActionForm";
import { ImageField } from "@/components/admin/ImageField";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { savePage } from "../../actions/pages";

export function PageForm({ page, coverSrc }: { page?: Page; coverSrc: string | null }) {
  const p = page;
  return (
    <ActionForm action={savePage} className="stack" style={{ gap: 20 }}>
      {p && <input type="hidden" name="id" value={p.id} />}
      <section className="form-section">
        <div className="form-grid">
          <div className="field full">
            <label htmlFor="title">Judul</label>
            <input id="title" name="title" defaultValue={p?.title} required placeholder="contoh: Paving Block Karawang" />
          </div>
          <div className="field">
            <label htmlFor="slug">Slug URL <span className="help">kosongkan untuk dibuat dari judul; tayang di /slug</span></label>
            <input id="slug" name="slug" defaultValue={p?.slug} placeholder="contoh: paving-block-karawang" />
          </div>
          <div className="field">
            <label htmlFor="kind">Jenis halaman <span className="help">Area = tombol WhatsApp menanyakan ongkir ke lokasi ini</span></label>
            <select id="kind" name="kind" defaultValue={p?.kind ?? "info"}>
              {pageKinds.map((k) => (
                <option key={k} value={k}>{PAGE_KIND_LABEL[k]}</option>
              ))}
            </select>
          </div>
          <div className="field full">
            <label className="check"><input type="checkbox" name="published" defaultChecked={p?.published ?? false} /> Terbitkan</label>
          </div>
          <div className="field full">
            <label htmlFor="excerpt">Ringkasan <span className="help">1–2 kalimat, tampil di bawah judul</span></label>
            <textarea id="excerpt" name="excerpt" rows={2} maxLength={300} defaultValue={p?.excerpt} />
          </div>
        </div>
        <ImageField name="cover" current={coverSrc} label="Gambar sampul (opsional)" />
        <div className="field">
          <label htmlFor="content">Isi halaman <span className="help">Markdown: ## Subjudul, **tebal**, - daftar, tabel | Kolom | Kolom |, [tautan](/produk/paving-block)</span></label>
          <textarea id="content" name="content" className="tall" style={{ minHeight: 460 }} defaultValue={p?.content} />
        </div>
      </section>
      <section className="form-section">
        <h2>SEO</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="seoTitle">Judul SEO <span className="help">≤ 60 karakter; kosong = judul halaman</span></label>
            <input id="seoTitle" name="seoTitle" maxLength={70} defaultValue={p?.seoTitle ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="seoDescription">Deskripsi SEO <span className="help">kosong = ringkasan</span></label>
            <textarea id="seoDescription" name="seoDescription" maxLength={170} rows={3} defaultValue={p?.seoDescription ?? ""} />
          </div>
        </div>
      </section>
      <div className="form-actions">
        <SubmitButton>{p ? "Simpan perubahan" : "Simpan halaman"}</SubmitButton>
        <Link href="/situs/halaman" className="btn btn-ghost">Batal</Link>
        {p?.published && <Link href={`/${p.slug}`} target="_blank">Lihat di situs ↗</Link>}
      </div>
    </ActionForm>
  );
}
