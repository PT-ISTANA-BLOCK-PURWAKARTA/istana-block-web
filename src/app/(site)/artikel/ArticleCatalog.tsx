"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArticleCard, type ArticleCardItem } from "@/components/ArticleCard";
import { ArticleCover } from "@/components/ArticleCover";
import { Select, type SelectOption } from "@/components/ui";
import { resolveArticleCover } from "@/lib/article-cover";

export type ArticleSort = "terbaru" | "terlama" | "judul";
export type ArticlePerPage = "auto" | "12" | "24" | "48" | "semua";

const SORT_OPTIONS: SelectOption[] = [
  { value: "terbaru", label: "Urutkan: Terbaru" },
  { value: "terlama", label: "Urutkan: Terlama" },
  { value: "judul", label: "Urutkan: Judul A–Z" },
];

const norm = (s: string) =>
  s
    .toLocaleLowerCase("id")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

function buildHref(q: string, category: string, sort: ArticleSort, perPage: ArticlePerPage, page: number) {
  const sp = new URLSearchParams();
  if (category) sp.set("kategori", category);
  if (q.trim()) sp.set("q", q.trim());
  if (sort !== "terbaru") sp.set("urut", sort);
  if (perPage !== "auto") sp.set("tampil", perPage);
  if (page > 1) sp.set("hal", String(page));
  const qs = sp.toString();
  return qs ? `/artikel?${qs}` : "/artikel";
}

function pageWindow(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  const start = Math.max(2, Math.min(current - 1, total - 3));
  const end = Math.min(total - 1, Math.max(current + 1, 3));
  if (start > 2) pages.push("...");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("...");
  pages.push(total);
  return pages;
}

export function ArticleCatalog({
  items,
  categories,
  initialQuery,
  initialCategory,
  initialSort,
  initialPerPage = "auto",
  initialPage,
}: {
  items: ArticleCardItem[];
  categories: readonly string[];
  initialQuery: string;
  initialCategory: string;
  initialSort: ArticleSort;
  initialPerPage?: ArticlePerPage;
  initialPage: number;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState<ArticleSort>(initialSort);
  const [perPage, setPerPage] = useState<ArticlePerPage>(initialPerPage);
  const [autoLimit, setAutoLimit] = useState(12); // SSR dimulai bersih di 12, lalu sinkron setelah mount.
  const [page, setPage] = useState(initialPage);
  const [jumpInput, setJumpInput] = useState(String(initialPage));
  const listAnchor = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    const syncLimit = () => {
      const w = window.innerWidth;
      setAutoLimit(w < 640 ? 6 : w < 1024 ? 9 : 12);
    };
    syncLimit();
    window.addEventListener("resize", syncLimit);
    return () => window.removeEventListener("resize", syncLimit);
  }, []);

  const perPageOptions = useMemo<SelectOption[]>(
    () => [
      { value: "auto", label: `Tampil: Auto (${autoLimit})`, hint: "6 HP · 9 tablet · 12 desktop" },
      { value: "12", label: "Tampil: 12" },
      { value: "24", label: "Tampil: 24" },
      { value: "48", label: "Tampil: 48" },
      { value: "semua", label: "Tampil: Semua" },
    ],
    [autoLimit],
  );

  const searchWords = useMemo(() => norm(query.trim()).split(/\s+/).filter(Boolean), [query]);

  // Cocokkan pencarian teks terlebih dulu agar hitungan di setiap chip kategori tetap akurat.
  const queryMatched = useMemo(() => {
    if (!searchWords.length) return items;
    return items.filter((item) => {
      const hay = norm(`${item.title} ${item.excerpt} ${item.category}`);
      return searchWords.every((w) => hay.includes(w));
    });
  }, [items, searchWords]);

  const catCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of categories) map.set(c, 0);
    for (const item of queryMatched) {
      map.set(item.category, (map.get(item.category) ?? 0) + 1);
    }
    return map;
  }, [categories, queryMatched]);

  const filtered = useMemo(() => {
    const base = category ? queryMatched.filter((x) => x.category === category) : queryMatched;
    if (sort === "terbaru") return base;
    const copy = [...base];
    if (sort === "terlama") {
      copy.sort((a, b) => a.publishedMs - b.publishedMs || a.id - b.id);
    } else {
      copy.sort((a, b) => a.title.localeCompare(b.title, "id"));
    }
    return copy;
  }, [queryMatched, category, sort]);

  const hasSpotlightMode = !searchWords.length && !category && sort === "terbaru" && filtered.length > 0;
  const pool = hasSpotlightMode ? filtered.slice(1) : filtered;
  const perPageLimit =
    perPage === "semua" ? Math.max(1, pool.length) : perPage === "auto" ? autoLimit : Number(perPage);
  const totalPages = Math.max(1, Math.ceil(pool.length / perPageLimit));
  const safePage = Math.min(page, totalPages);
  const showSpotlight = safePage === 1 && hasSpotlightMode;
  const spotlight = showSpotlight ? filtered[0] : null;
  const offset = (safePage - 1) * perPageLimit;
  const visible = pool.slice(offset, offset + perPageLimit);

  const totalDisplayed = filtered.length;
  const shownStart = totalDisplayed === 0 ? 0 : showSpotlight ? 1 : hasSpotlightMode ? offset + 2 : offset + 1;
  const shownEnd = totalDisplayed === 0 ? 0 : hasSpotlightMode ? 1 + offset + visible.length : offset + visible.length;

  useEffect(() => {
    setJumpInput(String(safePage));
  }, [safePage]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const next = buildHref(query, category, sort, perPage, safePage);
    if (window.location.pathname + window.location.search !== next) {
      window.history.replaceState(null, "", next);
    }
  }, [query, category, sort, perPage, safePage]);

  function scrollToList() {
    const el = listAnchor.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }

  function applyQuery(nextQ: string) {
    setQuery(nextQ);
    setPage(1);
  }

  function applyCategory(nextCat: string) {
    setCategory(nextCat);
    setPage(1);
  }

  function applySort(nextSort: ArticleSort) {
    setSort(nextSort);
    setPage(1);
  }

  function applyPerPage(nextPerPage: ArticlePerPage) {
    setPerPage(nextPerPage);
    setPage(1);
  }

  function applyPage(nextPage: number) {
    const clamped = Math.max(1, Math.min(totalPages, nextPage));
    setPage(clamped);
    scrollToList();
  }

  function submitPageJump() {
    const parsed = parseInt(jumpInput, 10);
    if (!Number.isFinite(parsed)) {
      setJumpInput(String(safePage));
      return;
    }
    const clamped = Math.max(1, Math.min(totalPages, parsed));
    setJumpInput(String(clamped));
    applyPage(clamped);
  }

  function resetAll() {
    setQuery("");
    setCategory("");
    setSort("terbaru");
    setPerPage("auto");
    setPage(1);
  }

  const hasFilter = Boolean(query.trim() || category || sort !== "terbaru" || perPage !== "auto");

  return (
    <div id="daftar-artikel" ref={listAnchor}>
      <section className="artikel-toolbar" aria-label="Cari dan saring artikel">
        <div className="artikel-controls">
          <div className="artikel-search" role="search">
            <label htmlFor="artikel-q" className="sr-only">Cari artikel</label>
            <svg className="artikel-search-ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              id="artikel-q"
              type="search"
              name="q"
              value={query}
              onChange={(e) => applyQuery(e.target.value)}
              placeholder="Cari judul atau topik, mis. drainase, K-350, carport…"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                className="artikel-clear"
                onClick={() => applyQuery("")}
                aria-label="Hapus kata pencarian"
              >
                ×
              </button>
            )}
          </div>
          <div className="artikel-selects">
            <div className="artikel-sort-wrap">
              <label htmlFor="artikel-urut" className="sr-only">Urutkan artikel</label>
              <Select
                id="artikel-urut"
                name="urut"
                className="ui-site-ctrl artikel-select-sort"
                aria-label="Urutkan artikel"
                value={sort}
                onChange={(v) => applySort(v as ArticleSort)}
                options={SORT_OPTIONS}
                menuWidth={220}
              />
            </div>
            <div className="artikel-limit-wrap">
              <label htmlFor="artikel-tampil" className="sr-only">Jumlah artikel per halaman</label>
              <Select
                id="artikel-tampil"
                name="tampil"
                className="ui-site-ctrl artikel-select-limit"
                aria-label="Jumlah artikel per halaman"
                value={perPage}
                onChange={(v) => applyPerPage(v as ArticlePerPage)}
                options={perPageOptions}
                menuWidth={230}
              />
            </div>
          </div>
        </div>

        <nav className="chips artikel-chips" aria-label="Saring topik artikel">
          <a
            href={buildHref(query, "", sort, perPage, 1)}
            className="chip-link"
            aria-current={category === "" ? "true" : undefined}
            onClick={(e) => {
              if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                applyCategory("");
              }
            }}
          >
            Semua <span className="chip-count">{queryMatched.length}</span>
          </a>
          {categories.map((c) => {
            const count = catCounts.get(c) ?? 0;
            const active = category === c;
            return (
              <a
                key={c}
                href={buildHref(query, c, sort, perPage, 1)}
                className={`chip-link${count === 0 && !active ? " is-empty" : ""}`}
                aria-current={active ? "true" : undefined}
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                    e.preventDefault();
                    applyCategory(active ? "" : c);
                  }
                }}
              >
                {c} <span className="chip-count">{count}</span>
              </a>
            );
          })}
        </nav>
      </section>

      <div className="artikel-status" aria-live="polite">
        <span className="small muted">
          {totalDisplayed === 0
            ? "Tidak ada artikel yang cocok."
            : `Menampilkan ${shownStart}–${shownEnd} dari ${totalDisplayed} artikel`}
          {totalPages > 1 && totalDisplayed > 0 ? ` · Halaman ${safePage} dari ${totalPages}` : ""}
        </span>
        {hasFilter && (
          <button type="button" className="artikel-reset" onClick={resetAll}>
            Reset filter
          </button>
        )}
      </div>

      {spotlight && (() => {
        const spotCover = resolveArticleCover({
          title: spotlight.title,
          category: spotlight.category,
          excerpt: spotlight.excerpt,
          coverMeta: spotlight.coverMeta,
        });
        return (
          <Link prefetch={false} href={`/artikel/${spotlight.slug}`} className="card artikel-spotlight">
            <div className="artikel-spotlight-media hexlong">
              <ArticleCover
                variant="spotlight"
                title={spotCover.title}
                category={spotCover.badgeCategory}
                themeCategory={spotCover.themeCategory}
                excerpt={spotCover.excerpt}
                coverSrc={spotlight.coverSrc}
                sizes="(max-width: 900px) 92vw, 540px"
                priority
              />
            </div>
            <div className="artikel-spotlight-body">
              <div className="artikel-card-meta">
                <span className="artikel-badge-new">Terbaru</span>
                <span className="artikel-cat">{spotlight.category}</span>
                {spotlight.publishedDate && <span className="small muted">{spotlight.publishedDate}</span>}
              </div>
              <h2>{spotlight.title}</h2>
              {spotlight.excerpt && <p>{spotlight.excerpt}</p>}
              <div className="card-foot artikel-foot">
                <span className="small muted">{spotlight.readMinutes} menit baca</span>
                <span className="artikel-read-more">Baca panduan <span className="card-arrow hex" aria-hidden="true">→</span></span>
              </div>
            </div>
          </Link>
        );
      })()}

      {visible.length > 0 ? (
        <div className="grid-cards artikel-grid">
          {visible.map((item, idx) => (
            <ArticleCard key={item.id} item={item} eager={!spotlight && idx < 3} headingLevel="h2" />
          ))}
        </div>
      ) : (
        !spotlight && (
          <div className="panel artikel-empty">
            <h2>Artikel tidak ditemukan</h2>
            <p className="muted">
              Belum ada artikel yang cocok dengan kata kunci <b>“{query}”</b>
              {category ? ` pada topik ${category}` : ""}. Coba kata lain atau tampilkan semua panduan.
            </p>
            <button type="button" className="btn btn-primary btn-sm" style={{ alignSelf: "flex-start" }} onClick={resetAll}>
              Tampilkan semua artikel
            </button>
          </div>
        )
      )}

      {totalPages > 1 && (
        <nav className="artikel-pager" aria-label="Navigasi halaman artikel">
          {safePage > 1 ? (
            <a
              href={buildHref(query, category, sort, perPage, safePage - 1)}
              className="btn btn-ghost btn-sm"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                  e.preventDefault();
                  applyPage(safePage - 1);
                }
              }}
            >
              ← Sebelumnya
            </a>
          ) : (
            <span className="btn btn-ghost btn-sm is-disabled" aria-disabled="true">← Sebelumnya</span>
          )}

          <div className="pager-nums">
            {pageWindow(safePage, totalPages).map((entry, idx) =>
              entry === "..." ? (
                <span key={`gap-${idx}`} className="pager-gap" aria-hidden="true">…</span>
              ) : (
                <a
                  key={entry}
                  href={buildHref(query, category, sort, perPage, entry)}
                  className={`pager-num${entry === safePage ? " is-active" : ""}`}
                  aria-current={entry === safePage ? "page" : undefined}
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                      e.preventDefault();
                      applyPage(entry);
                    }
                  }}
                >
                  {entry}
                </a>
              ),
            )}
          </div>

          {safePage < totalPages ? (
            <a
              href={buildHref(query, category, sort, perPage, safePage + 1)}
              className="btn btn-ghost btn-sm"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                  e.preventDefault();
                  applyPage(safePage + 1);
                }
              }}
            >
              Berikutnya →
            </a>
          ) : (
            <span className="btn btn-ghost btn-sm is-disabled" aria-disabled="true">Berikutnya →</span>
          )}

          <form
            className="pager-jump"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              submitPageJump();
            }}
          >
            <label htmlFor="artikel-hal-lompat" className="pager-jump-label">
              Ke hal.
            </label>
            <input
              id="artikel-hal-lompat"
              type="number"
              inputMode="numeric"
              min={1}
              max={totalPages}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              aria-label={`Lompat ke halaman (1 sampai ${totalPages})`}
              className="pager-jump-input"
            />
            <button type="submit" className="btn btn-blue btn-sm pager-jump-btn">
              Buka
            </button>
          </form>
        </nav>
      )}
    </div>
  );
}
