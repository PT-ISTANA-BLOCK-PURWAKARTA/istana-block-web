"use client";

import Link from "next/link";
import type { Article } from "@/db/schema";
import { ActionForm } from "@/components/admin/ActionForm";
import { ImageField } from "@/components/admin/ImageField";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { saveArticle } from "../../actions/articles";

export function ArticleForm({ article, coverSrc }: { article?: Article; coverSrc: string | null }) {
  const a = article;
  return (
    <ActionForm action={saveArticle} className="stack" style={{ gap: 20 }}>
      {a && <input type="hidden" name="id" value={a.id} />}
      <section className="form-section">
        <div className="form-grid">
          <div className="field full">
            <label htmlFor="title">Judul</label>
            <input id="title" name="title" defaultValue={a?.title} required />
          </div>
          <div className="field">
            <label htmlFor="slug">Slug URL <span className="help">kosongkan untuk dibuat dari judul</span></label>
            <input id="slug" name="slug" defaultValue={a?.slug} />
          </div>
          <div className="field" style={{ justifyContent: "flex-end" }}>
            <label className="check"><input type="checkbox" name="published" defaultChecked={a?.published ?? false} /> Terbitkan</label>
          </div>
          <div className="field full">
            <label htmlFor="excerpt">Ringkasan <span className="help">1–2 kalimat, tampil di daftar artikel</span></label>
            <textarea id="excerpt" name="excerpt" rows={2} maxLength={300} defaultValue={a?.excerpt} />
          </div>
        </div>
        <ImageField name="cover" current={coverSrc} label="Gambar sampul" />
        <div className="field">
          <label htmlFor="content">Isi artikel <span className="help">Markdown: ## Subjudul, **tebal**, - daftar, [tautan](/produk/paving-block), ![alt](url gambar)</span></label>
          <textarea id="content" name="content" className="tall" style={{ minHeight: 460 }} defaultValue={a?.content} />
        </div>
      </section>
      <section className="form-section">
        <h2>SEO</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="seoTitle">Judul SEO <span className="help">≤ 60 karakter; kosong = judul artikel</span></label>
            <input id="seoTitle" name="seoTitle" maxLength={70} defaultValue={a?.seoTitle ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="seoDescription">Deskripsi SEO <span className="help">kosong = ringkasan</span></label>
            <textarea id="seoDescription" name="seoDescription" maxLength={170} rows={3} defaultValue={a?.seoDescription ?? ""} />
          </div>
        </div>
      </section>
      <div className="form-actions">
        <SubmitButton>{a ? "Simpan perubahan" : "Simpan artikel"}</SubmitButton>
        <Link href="/situs/artikel" className="btn btn-ghost">Batal</Link>
        {a?.published && <Link href={`/artikel/${a.slug}`} target="_blank">Lihat di situs ↗</Link>}
      </div>
    </ActionForm>
  );
}
