"use client";

import Link from "next/link";
import { PAGE_KIND_LABEL, pageKinds, type Page } from "@/db/schema";
import { ActionForm } from "@/components/admin/ActionForm";
import { ImageField } from "@/components/admin/ImageField";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { RichEditor } from "@/components/editor/RichEditor";
import { savePage } from "../../actions/pages";
import { Select, Switch } from "@/components/ui";

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
            <Select id="kind" name="kind" defaultValue={p?.kind ?? "info"} options={pageKinds.map((k) => ({ value: k, label: PAGE_KIND_LABEL[k] }))} />
          </div>
          <div className="field full">
            <Switch name="published" defaultChecked={p?.published ?? false} label="Terbitkan" help="Tampil di situs setelah disimpan" />
          </div>
          <div className="field full">
            <label htmlFor="excerpt">Ringkasan <span className="help">1–2 kalimat, tampil di bawah judul</span></label>
            <textarea id="excerpt" name="excerpt" rows={2} maxLength={300} defaultValue={p?.excerpt} />
          </div>
        </div>
        <ImageField name="cover" current={coverSrc} label="Gambar sampul (opsional)" />
        <div className="field">
          <span className="label" id="content-label">Isi halaman <span className="help">pakai tombol di atas untuk judul, daftar, tabel, tautan, dan gambar</span></span>
          <RichEditor name="content" labelledBy="content-label" defaultValue={p?.content ?? ""} folder="halaman" draftKey={`halaman:${p?.id ?? "baru"}`} placeholder="Tulis isi halaman di sini." minHeight={460} />
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
