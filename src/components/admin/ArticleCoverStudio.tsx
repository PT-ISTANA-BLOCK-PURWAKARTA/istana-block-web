"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { articleCategories } from "@/db/schema";
import { ArticleCover } from "@/components/ArticleCover";
import { ImageField } from "@/components/admin/ImageField";
import { Select } from "@/components/ui";
import { categoryCoverTheme, normalizeCoverTopicsInput, resolveArticleCover } from "@/lib/article-cover";

type CoverMode = "dynamic" | "photo";
type PreviewTab = "card" | "hero" | "both";

export function ArticleCoverStudio({
  title,
  category,
  excerpt,
  content,
  initialCoverSrc,
  coverMode,
  onCoverModeChange,
  coverTitle,
  onCoverTitleChange,
  coverExcerpt,
  onCoverExcerptChange,
  coverTopics,
  onCoverTopicsChange,
  coverTheme,
  onCoverThemeChange,
  autoTopics,
  onReset,
}: {
  title: string;
  category: string;
  excerpt: string;
  content: string;
  initialCoverSrc: string | null;
  coverMode: CoverMode;
  onCoverModeChange: (mode: CoverMode) => void;
  coverTitle: string;
  onCoverTitleChange: (v: string) => void;
  coverExcerpt: string;
  onCoverExcerptChange: (v: string) => void;
  coverTopics: string;
  onCoverTopicsChange: (v: string) => void;
  coverTheme: string;
  onCoverThemeChange: (v: string) => void;
  autoTopics: string[];
  onReset: () => void;
}) {
  const [view, setView] = useState<PreviewTab>("both");
  const [photoPreview, setPhotoPreview] = useState<string | null>(initialCoverSrc);
  const [fullOpen, setFullOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (fullOpen && !dlg.open) dlg.showModal();
    else if (!fullOpen && dlg.open) dlg.close();
  }, [fullOpen]);

  const parsedTopics = useMemo(() => normalizeCoverTopicsInput(coverTopics), [coverTopics]);

  const resolved = useMemo(
    () =>
      resolveArticleCover({
        title,
        category,
        excerpt,
        content,
        coverMeta: {
          title: coverTitle || undefined,
          excerpt: coverExcerpt || undefined,
          topics: parsedTopics.length > 0 ? parsedTopics : undefined,
          theme: (coverTheme || undefined) as (typeof articleCategories)[number] | undefined,
        },
      }),
    [title, category, excerpt, content, coverTitle, coverExcerpt, parsedTopics, coverTheme],
  );

  const effectivePhoto = coverMode === "photo" ? photoPreview : null;
  const readMinutes = Math.max(1, Math.round(content.length / 1200));

  const statusLabel =
    coverMode === "photo"
      ? photoPreview
        ? "Foto custom aktif"
        : "Belum pilih foto"
      : resolved.hasCustomOverride
        ? "Kustomisasi manual"
        : "Otomatis · ikut ketikan";

  const statusTone =
    coverMode === "photo"
      ? photoPreview
        ? "badge-on"
        : "badge-warn"
      : resolved.hasCustomOverride
        ? "badge-info"
        : "badge-on";

  const renderCardPreview = () => (
    <div className="card artikel-card studio-card-mock" aria-hidden="true">
      <div className="card-media hexlong">
        <ArticleCover
          variant="card"
          title={resolved.title}
          category={resolved.badgeCategory}
          themeCategory={resolved.themeCategory}
          excerpt={resolved.excerpt}
          coverSrc={effectivePhoto}
        />
      </div>
      <div className="card-body" style={{ paddingTop: 2 }}>
        <div className="artikel-card-meta">
          <span className="artikel-cat">{category}</span>
          <span className="small muted">Pratinjau</span>
        </div>
        <div className="artikel-card-title">{title.trim() || "Judul artikel Anda…"}</div>
        {(excerpt.trim() || resolved.excerpt) && (
          <p className="artikel-excerpt">{excerpt.trim() || resolved.excerpt}</p>
        )}
        <div className="card-foot artikel-foot">
          <span className="small muted">{readMinutes} mnt baca</span>
          <span className="card-arrow hex">→</span>
        </div>
      </div>
    </div>
  );

  const renderHeroPreview = (compact: boolean) => {
    if (effectivePhoto) {
      return (
        <figure className={`article-hero-frame${compact ? " is-compact" : ""}`}>
          <div className="article-hero-zoom" style={{ cursor: "default" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={effectivePhoto} alt={title || "Pratinjau foto sampul"} className="article-hero-img" />
          </div>
        </figure>
      );
    }
    const theme = categoryCoverTheme(resolved.themeCategory);
    return (
      <div
        className={`article-cover-hex hexlong hexpat${compact ? " is-compact" : ""}`}
        style={{
          ["--cov-from" as string]: theme.bgFrom,
          ["--cov-to" as string]: theme.bgTo,
          ["--cov-acc" as string]: theme.accent,
        }}
      >
        <div className="article-cover-hex-inner">
          <div className="artikel-dyn-kicker">
            <span className="artikel-dyn-dot" />
            <span>Istana Block · {resolved.badgeCategory}</span>
          </div>
          <p className="artikel-dyn-title">{resolved.title}</p>
          {resolved.excerpt && <p className="artikel-dyn-excerpt">{resolved.excerpt}</p>}
          {resolved.topics.length > 0 && (
            <ul className="artikel-dyn-topics">
              {resolved.topics.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  };

  return (
    <aside className="form-section studio-panel" aria-label="Studio pratinjau sampul artikel">
      <input type="hidden" name="coverMode" value={coverMode} />
      {coverMode !== "dynamic" && (
        <>
          <input type="hidden" name="coverTheme" value={coverTheme} />
          <input type="hidden" name="coverTitle" value={coverTitle} />
          <input type="hidden" name="coverExcerpt" value={coverExcerpt} />
          <input type="hidden" name="coverTopics" value={coverTopics} />
        </>
      )}

      <div className="studio-head">
        <div>
          <h2>Studio sampul</h2>
          <p className="small muted">Diperbarui langsung saat Anda mengetik.</p>
        </div>
        <span className={`badge ${statusTone}`} aria-live="polite">
          {statusLabel}
        </span>
      </div>

      <div className="studio-mode-row">
        <div className="seg" role="tablist" aria-label="Jenis sampul">
          <button
            type="button"
            role="tab"
            aria-selected={coverMode === "dynamic"}
            className={coverMode === "dynamic" ? "is-on" : ""}
            onClick={() => onCoverModeChange("dynamic")}
          >
            Sampul dinamis
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={coverMode === "photo"}
            className={coverMode === "photo" ? "is-on" : ""}
            onClick={() => onCoverModeChange("photo")}
          >
            Foto unggahan
          </button>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setFullOpen(true)}
        >
          Pratinjau penuh
        </button>
      </div>

      <div className="studio-view-row">
        <span className="small muted">Tampilan:</span>
        <div className="seg" role="group" aria-label="Mode tampilan pratinjau">
          {(
            [
              ["card", "Kartu"],
              ["hero", "Hero"],
              ["both", "Keduanya"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              className={view === id ? "is-on" : ""}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="studio-preview-stage">
        {(view === "card" || view === "both") && (
          <div className="studio-preview-block">
            <span className="studio-preview-lbl">Tampilan Kartu (`/artikel` &amp; Beranda)</span>
            {renderCardPreview()}
          </div>
        )}
        {(view === "hero" || view === "both") && (
          <div className="studio-preview-block">
            <span className="studio-preview-lbl">Tampilan Detail (`/artikel/[slug]`)</span>
            {renderHeroPreview(true)}
          </div>
        )}
      </div>

      {coverMode === "photo" ? (
        <div className="studio-photo-box">
          <ImageField
            name="cover"
            current={photoPreview}
            label="Unggah foto sampul custom"
            onPreviewChange={setPhotoPreview}
            hideRemoveCheckbox
          />
          {photoPreview && (
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setPhotoPreview(null);
                onCoverModeChange("dynamic");
              }}
            >
              Hapus foto &amp; pakai sampul dinamis
            </button>
          )}
        </div>
      ) : (
        <div className="studio-controls">
          <div className="studio-controls-head">
            <b>Sesuaikan isi &amp; gaya cover</b>
            <button
              type="button"
              className="studio-reset"
              disabled={!resolved.hasCustomOverride}
              onClick={onReset}
            >
              Reset ikut artikel
            </button>
          </div>

          <div className="field">
            <label htmlFor="coverTheme">Tema warna &amp; motif visual</label>
            <Select
              id="coverTheme"
              name="coverTheme"
              value={coverTheme}
              onChange={onCoverThemeChange}
              options={[
                { value: "", label: `Otomatis (ikuti ${category})` },
                ...articleCategories.map((c) => ({ value: c, label: c })),
              ]}
            />
          </div>

          <div className="field">
            <label htmlFor="coverTitle">
              Judul di cover <span className="help">kosong = ikut judul artikel</span>
            </label>
            <input
              id="coverTitle"
              name="coverTitle"
              maxLength={160}
              autoComplete="off"
              value={coverTitle}
              onChange={(e) => onCoverTitleChange(e.target.value)}
              placeholder={title.trim() || "Otomatis dari judul artikel…"}
            />
          </div>

          <div className="field">
            <label htmlFor="coverExcerpt">
              Subteks di cover <span className="help">kosong = ikut ringkasan artikel</span>
            </label>
            <textarea
              id="coverExcerpt"
              name="coverExcerpt"
              rows={2}
              maxLength={300}
              value={coverExcerpt}
              onChange={(e) => onCoverExcerptChange(e.target.value)}
              placeholder={excerpt.trim() || "Otomatis dari ringkasan artikel…"}
            />
          </div>

          <div className="field">
            <label htmlFor="coverTopics">
              Poin bahasan hero <span className="help">maks. 3, pisahkan baris baru atau koma</span>
            </label>
            <textarea
              id="coverTopics"
              name="coverTopics"
              rows={2}
              maxLength={260}
              value={coverTopics}
              onChange={(e) => onCoverTopicsChange(e.target.value)}
              placeholder={
                autoTopics.length
                  ? autoTopics.join(", ")
                  : "Otomatis dari subjudul H2 di isi artikel…"
              }
            />
            {autoTopics.length > 0 && !coverTopics.trim() && (
              <span className="help">
                Subjudul H2 terdeteksi: {autoTopics.join(" · ")}
              </span>
            )}
          </div>
        </div>
      )}

      <dialog
        ref={dialogRef}
        className="studio-modal"
        aria-label="Pratinjau ukuran penuh sampul artikel"
        onClose={() => setFullOpen(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        {fullOpen && (
          <div className="studio-modal-body">
            <div className="studio-modal-head">
              <div>
                <strong>Pratinjau Skala Desktop (1:1)</strong>
                <span className="small muted">
                  Menampilkan sampul sesuai lebar nyata di situs publik.
                </span>
              </div>
              <button
                type="button"
                className="icon-btn"
                aria-label="Tutup pratinjau penuh"
                style={{ color: "var(--p-muted)" }}
                onClick={() => dialogRef.current?.close()}
              >
                ×
              </button>
            </div>

            <div className="studio-modal-stage">
              <div>
                <span className="studio-preview-lbl">1. Kartu di Halaman Daftar (`/artikel` &amp; Beranda)</span>
                {renderCardPreview()}
              </div>
              <div>
                <span className="studio-preview-lbl">2. Sampul di Halaman Detail (`/artikel/[slug]`)</span>
                <div style={{ maxWidth: 820 }}>{renderHeroPreview(false)}</div>
              </div>
            </div>
          </div>
        )}
      </dialog>
    </aside>
  );
}
