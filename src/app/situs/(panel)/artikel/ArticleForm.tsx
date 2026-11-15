"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { articleCategories, type Article } from "@/db/schema";
import { extractArticleTopics, isRealArticleCover } from "@/lib/article-cover";
import { ActionForm } from "@/components/admin/ActionForm";
import { ArticleCoverStudio } from "@/components/admin/ArticleCoverStudio";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { RichEditor } from "@/components/editor/RichEditor";
import { Select, Switch } from "@/components/ui";
import { saveArticle } from "../../actions/articles";

export function ArticleForm({ article, coverSrc }: { article?: Article; coverSrc: string | null }) {
  const a = article;
  const realCover = isRealArticleCover(coverSrc) ? coverSrc : null;

  const [title, setTitle] = useState(a?.title ?? "");
  const [category, setCategory] = useState<string>(a?.category ?? articleCategories[0]);
  const [excerpt, setExcerpt] = useState(a?.excerpt ?? "");
  const [content, setContent] = useState(a?.content ?? "");

  const [coverMode, setCoverMode] = useState<"dynamic" | "photo">(realCover ? "photo" : "dynamic");
  const [coverTitle, setCoverTitle] = useState(a?.coverMeta?.title ?? "");
  const [coverExcerpt, setCoverExcerpt] = useState(a?.coverMeta?.excerpt ?? "");
  const [coverTopics, setCoverTopics] = useState(a?.coverMeta?.topics?.join("\n") ?? "");
  const [coverTheme, setCoverTheme] = useState<string>(a?.coverMeta?.theme ?? "");

  const autoTopics = useMemo(() => extractArticleTopics(content, 3), [content]);

  function resetCoverOverrides() {
    setCoverTitle("");
    setCoverExcerpt("");
    setCoverTopics("");
    setCoverTheme("");
  }

  return (
    <ActionForm action={saveArticle} className="stack" style={{ gap: 20 }}>
      {a && <input type="hidden" name="id" value={a.id} />}
      <div className="article-studio-grid">
        <div className="article-studio-main stack" style={{ gap: 20 }}>
          <section className="form-section">
            <div className="form-grid">
              <div className="field full">
                <label htmlFor="title">Judul</label>
                <input
                  id="title"
                  name="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="mis. Harga Paving Block Purwakarta 2026 per m²…"
                />
              </div>
              <div className="field">
                <label htmlFor="category">Kategori topik</label>
                <Select
                  id="category"
                  name="category"
                  value={category}
                  onChange={setCategory}
                  options={articleCategories.map((c) => ({ value: c, label: c }))}
                />
              </div>
              <div className="field">
                <label htmlFor="slug">Slug URL <span className="help">kosongkan untuk dibuat dari judul</span></label>
                <input id="slug" name="slug" defaultValue={a?.slug} spellCheck={false} />
              </div>
              <div className="field full" style={{ justifyContent: "flex-end" }}>
                <Switch name="published" defaultChecked={a?.published ?? false} label="Terbitkan" help="Tampil di situs setelah disimpan" />
              </div>
              <div className="field full">
                <label htmlFor="excerpt">Ringkasan <span className="help">1–2 kalimat, tampil di daftar artikel</span></label>
                <textarea
                  id="excerpt"
                  name="excerpt"
                  rows={2}
                  maxLength={300}
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  placeholder="Ringkasan singkat isi panduan…"
                />
              </div>
            </div>
            <div className="field">
              <span className="label" id="content-label">Isi artikel <span className="help">gunakan tombol Judul (H2) untuk membentuk poin bahasan sampul secara otomatis</span></span>
              <RichEditor
                name="content"
                labelledBy="content-label"
                defaultValue={a?.content ?? ""}
                folder="artikel"
                draftKey={`artikel:${a?.id ?? "baru"}`}
                placeholder="Tulis isi artikel. Mulai dengan paragraf pembuka, lalu tambahkan Judul untuk tiap bagian."
                minHeight={460}
                onContentChange={setContent}
              />
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
        </div>

        <div className="article-studio-side">
          <ArticleCoverStudio
            title={title}
            category={category}
            excerpt={excerpt}
            content={content}
            initialCoverSrc={realCover}
            coverMode={coverMode}
            onCoverModeChange={setCoverMode}
            coverTitle={coverTitle}
            onCoverTitleChange={setCoverTitle}
            coverExcerpt={coverExcerpt}
            onCoverExcerptChange={setCoverExcerpt}
            coverTopics={coverTopics}
            onCoverTopicsChange={setCoverTopics}
            coverTheme={coverTheme}
            onCoverThemeChange={setCoverTheme}
            autoTopics={autoTopics}
            onReset={resetCoverOverrides}
          />
        </div>
      </div>

      <div className="form-actions">
        <SubmitButton>{a ? "Simpan perubahan" : "Simpan artikel"}</SubmitButton>
        <Link href="/situs/artikel" className="btn btn-ghost">Batal</Link>
        {a?.published && <Link href={`/artikel/${a.slug}`} target="_blank">Lihat di situs ↗</Link>}
      </div>
    </ActionForm>
  );
}
