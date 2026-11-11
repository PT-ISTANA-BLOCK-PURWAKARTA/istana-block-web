"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArticleCard, type ArticleCardItem } from "@/components/ArticleCard";
import { ArticleCover } from "@/components/ArticleCover";

const PER_PAGE = 12;

export type ArticleSort = "terbaru" | "terlama" | "judul";

const norm = (s: string) =>
  s
    .toLocaleLowerCase("id")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

function buildHref(q: string, category: string, sort: ArticleSort, page: number) {
  const sp = new URLSearchParams();
  if (category) sp.set("kategori", category);
  if (q.trim()) sp.set("q", q.trim());
  if (sort !== "terbaru") sp.set("urut", sort);
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
  initialPage,
}: {
  items: ArticleCardItem[];
  categories: readonly string[];
  initialQuery: string;
  initialCategory: string;
  initialSort: ArticleSort;
  initialPage: number;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState<ArticleSort>(initialSort);
  const [page, setPage] = useState(initialPage);
  const listAnchor = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

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
  const showSpotlight = page === 1 && hasSpotlightMode;
  const spotlight = showSpotlight ? filtered[0] : null;
  const pool = hasSpotlightMode ? filtered.slice(1) : filtered;
  const totalPages = Math.max(1, Math.ceil(pool.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * PER_PAGE;
  const visible = pool.slice(offset, offset + PER_PAGE);

  const totalDisplayed = filtered.length;
  const shownStart = totalDisplayed === 0 ? 0 : showSpotlight ? 1 : hasSpotlightMode ? offset + 2 : offset + 1;
  const shownEnd = totalDisplayed === 0 ? 0 : hasSpotlightMode ? 1 + offset + visible.length : offset + visible.length;

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const next = buildHref(query, category, sort, safePage);
    if (window.location.pathname + window.location.search !== next) {
      window.history.replaceState(null, "", next);
    }
  }, [query, category, sort, safePage]);

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

  function applyPage(nextPage: number) {
    const clamped = Math.max(1, Math.min(totalPages, nextPage));
    setPage(clamped);
    scrollToList();
  }

  function resetAll() {
    setQuery("");
    setCategory("");
    setSort("terbaru");
    setPage(1);
  }

  const hasFilter = Boolean(query.trim() || category || sort !== "terbaru");

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
          <div className="artikel-sort-wrap">
            <label htmlFor="artikel-urut" className="sr-only">Urutkan artikel</label>
            <select
              id="artikel-urut"
              name="urut"
              className="artikel-sort"
              value={sort}
              onChange={(e) => applySort(e.target.value as ArticleSort)}
            >
              <option value="terbaru">Urutkan: Terbaru</option>
              <option value="terlama">Urutkan: Terlama</option>
              <option value="judul">Urutkan: Judul A–Z</option>
            </select>
          </div>
        </div>

        <nav className="chips artikel-chips" aria-label="Saring topik artikel">
          <a
            href={buildHref(query, "", sort, 1)}
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
                href={buildHref(query, c, sort, 1)}
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

      {spotlight && (
        <Link prefetch={false} href={`/artikel/${spotlight.slug}`} className="card artikel-spotlight">
          <div className="artikel-spotlight-media hexlong">
            <ArticleCover
              variant="spotlight"
              title={spotlight.title}
              category={spotlight.category}
              excerpt={spotlight.excerpt}
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
      )}

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
              href={buildHref(query, category, sort, safePage - 1)}
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
                  href={buildHref(query, category, sort, entry)}
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
              href={buildHref(query, category, sort, safePage + 1)}
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
        </nav>
      )}
    </div>
  );
}
