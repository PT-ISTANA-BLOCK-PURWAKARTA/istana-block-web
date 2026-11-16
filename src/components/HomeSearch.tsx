"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { waLink } from "@/lib/format";
import type { SearchIndexItem, SearchItemType } from "@/lib/search-index";

type SearchScope = "all" | "produk" | "sampel" | "artikel" | "area" | "katalog";

type PreparedItem = SearchIndexItem & {
  scope: Exclude<SearchScope, "all">;
  nTitle: string;
  cTitle: string;
  nBadge: string;
  cBadge: string;
  nSub: string;
  cSub: string;
  nText: string;
  cText: string;
  nAll: string;
  cAll: string;
};

type ParsedToken = {
  raw: string;
  norm: string;
  compact: string;
};

type ParsedQuery = {
  trimmed: string;
  fullNorm: string;
  fullCompact: string;
  tokens: ParsedToken[];
};

type MappedText = {
  raw: string;
  norm: string;
  normStart: number[];
  normEnd: number[];
  compact: string;
  compactStart: number[];
  compactEnd: number[];
};

type Range = [number, number];

const TYPE_WEIGHT: Record<SearchItemType, number> = {
  produk: 28,
  sampel: 20,
  area: 16,
  katalog: 12,
  info: 12,
  artikel: 0,
};

const SCOPE_TABS: { id: SearchScope; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "produk", label: "Produk" },
  { id: "sampel", label: "Sampel" },
  { id: "artikel", label: "Artikel" },
  { id: "area", label: "Area" },
  { id: "katalog", label: "Katalog & Info" },
];

const QUICK_SUGGESTIONS: { label: string; query: string }[] = [
  { label: "Paving K-350", query: "Paving K-350" },
  { label: "Gravel (Greffel)", query: "Gravel" },
  { label: "U-Ditch 40×40", query: "U-Ditch 40×40" },
  { label: "TKDN 91,58", query: "TKDN 91,58" },
  { label: "Jasa pasang", query: "Jasa pasang" },
  { label: "Bekasi", query: "Bekasi" },
];

const PLACEHOLDER_QUERIES = [
  "Paving Block K-350…",
  "Gravel (Greffel) beton…",
  "U-Ditch 40×40 + Cover…",
  "Sertifikat TKDN Kemenperin…",
  "Kalkulator pola Hexagon…",
] as const;

const MAX_RESULTS = 30;

let cachedItems: PreparedItem[] | null = null;
let inflightFetch: Promise<PreparedItem[]> | null = null;

function normCh(ch: string): string {
  const s = ch.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (s === "×") return "x";
  if (s === "–" || s === "—") return "-";
  return s;
}

function scanText(raw: string, mapPositions: boolean): MappedText {
  let norm = "";
  const normStart: number[] = [];
  const normEnd: number[] = [];
  let compact = "";
  const compactStart: number[] = [];
  const compactEnd: number[] = [];
  let prevNormSpace = false;
  let prevCompactSpace = false;

  for (let i = 0; i < raw.length; i++) {
    const s = normCh(raw[i]);
    const isCommaSep = raw[i] === "," && (i + 1 >= raw.length || /\s/.test(raw[i + 1]));
    for (let j = 0; j < s.length; j++) {
      const c = s[j];
      if (/\s/.test(c)) {
        if (!prevNormSpace && norm.length > 0) {
          norm += " ";
          if (mapPositions) {
            normStart.push(i);
            normEnd.push(i + 1);
          }
          prevNormSpace = true;
        }
      } else {
        norm += c;
        if (mapPositions) {
          normStart.push(i);
          normEnd.push(i + 1);
        }
        prevNormSpace = false;
      }

      if (/[a-z0-9]/.test(c)) {
        compact += c;
        if (mapPositions) {
          compactStart.push(i);
          compactEnd.push(i + 1);
        }
        prevCompactSpace = false;
      } else if (/[·;:()[\]|\n]/.test(c) || isCommaSep) {
        if (!prevCompactSpace && compact.length > 0) {
          compact += " ";
          if (mapPositions) {
            compactStart.push(i);
            compactEnd.push(i + 1);
          }
          prevCompactSpace = true;
        }
      }
    }
  }

  return {
    raw,
    norm: mapPositions ? norm : norm.trim(),
    normStart,
    normEnd,
    compact: mapPositions ? compact : compact.trim(),
    compactStart,
    compactEnd,
  };
}

function toNormAndCompact(raw: string): { norm: string; compact: string } {
  const { norm, compact } = scanText(raw, false);
  return { norm, compact };
}

function parseQuery(raw: string): ParsedQuery | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const full = toNormAndCompact(trimmed);
  const foldedDims = trimmed.replace(/(\d)\s*[×x]\s*(?=\d)/gi, "$1x");
  const rawTokens = foldedDims.split(/\s+/).filter(Boolean);
  const tokens: ParsedToken[] = [];
  const seen = new Set<string>();

  for (const rt of rawTokens) {
    const nc = toNormAndCompact(rt);
    if (!nc.norm && !nc.compact) continue;
    const key = `${nc.norm}|${nc.compact}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tokens.push({ raw: rt, norm: nc.norm, compact: nc.compact });
  }

  if (!tokens.length) return null;
  return {
    trimmed,
    fullNorm: full.norm,
    fullCompact: full.compact,
    tokens,
  };
}

function isDigitBoundaryOk(raw: string, origStart: number, needle: string): boolean {
  if (!needle || !/\d/.test(needle[0])) return true;
  return origStart === 0 || !/\d/.test(raw[origStart - 1]);
}

function findIndexBoundaryAware(haystack: string, needle: string): number {
  if (!needle) return -1;
  let from = 0;
  const startsDigit = /\d/.test(needle[0]);
  while (from <= haystack.length - needle.length) {
    const pos = haystack.indexOf(needle, from);
    if (pos === -1) return -1;
    if (!startsDigit || pos === 0 || !/\d/.test(haystack[pos - 1])) return pos;
    from = pos + 1;
  }
  return -1;
}

function matchField(normField: string, compactField: string, tok: ParsedToken): number {
  const nPos = tok.norm ? findIndexBoundaryAware(normField, tok.norm) : -1;
  if (nPos !== -1) {
    const atBoundary = nPos === 0 || !/[a-z0-9]/.test(normField[nPos - 1]);
    return atBoundary ? 2 : 1;
  }
  if (tok.compact.length >= 2) {
    const cPos = findIndexBoundaryAware(compactField, tok.compact);
    if (cPos !== -1) {
      const atBoundary = cPos === 0 || compactField[cPos - 1] === " ";
      return atBoundary ? 2 : 1;
    }
  }
  return 0;
}

function scoreItem(item: PreparedItem, q: ParsedQuery): number {
  for (const tok of q.tokens) {
    if (matchField(item.nAll, item.cAll, tok) === 0) return -1;
  }

  let score = TYPE_WEIGHT[item.type] ?? 0;

  if (q.fullNorm && item.nTitle === q.fullNorm) score += 220;
  else if (q.fullNorm && item.nTitle.startsWith(q.fullNorm)) score += 140;
  else if (q.fullNorm && findIndexBoundaryAware(item.nTitle, q.fullNorm) !== -1) score += 90;
  else if (q.fullCompact.length >= 2 && !q.trimmed.includes(" ") && findIndexBoundaryAware(item.cTitle, q.fullCompact) !== -1) score += 85;

  if (q.fullNorm && findIndexBoundaryAware(item.nSub, q.fullNorm) !== -1) score += 45;
  if (q.fullNorm && findIndexBoundaryAware(item.nText, q.fullNorm) !== -1) score += 24;

  for (const tok of q.tokens) {
    const tHit = matchField(item.nTitle, item.cTitle, tok);
    if (tHit === 2) score += 42;
    else if (tHit === 1) score += 26;

    if (matchField(item.nBadge, item.cBadge, tok) > 0) score += 26;

    const sHit = matchField(item.nSub, item.cSub, tok);
    if (sHit === 2) score += 18;
    else if (sHit === 1) score += 12;

    if (matchField(item.nText, item.cText, tok) > 0) score += 8;
  }

  return score;
}

function collectMatchesInMapped(mapped: MappedText, needle: string, useCompact: boolean, out: Range[]) {
  if (!needle) return;
  const hay = useCompact ? mapped.compact : mapped.norm;
  const starts = useCompact ? mapped.compactStart : mapped.normStart;
  const ends = useCompact ? mapped.compactEnd : mapped.normEnd;

  let from = 0;
  let hits = 0;
  while (from <= hay.length - needle.length && hits < 24) {
    const pos = hay.indexOf(needle, from);
    if (pos === -1) break;
    const origStart = starts[pos];
    const origEnd = ends[pos + needle.length - 1];
    if (origStart !== undefined && origEnd !== undefined && isDigitBoundaryOk(mapped.raw, origStart, needle)) {
      out.push([origStart, origEnd]);
      hits++;
      from = pos + needle.length;
    } else {
      from = pos + 1;
    }
  }
}

function mergeRanges(ranges: Range[]): Range[] {
  if (ranges.length <= 1) return ranges;
  const sorted = [...ranges].sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged: Range[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = merged[merged.length - 1];
    if (cur[0] <= last[1]) {
      if (cur[1] > last[1]) last[1] = cur[1];
    } else {
      merged.push(cur);
    }
  }
  return merged;
}

function findHighlightRanges(raw: string, q: ParsedQuery): Range[] {
  if (!raw) return [];
  const mapped = scanText(raw, true);
  const ranges: Range[] = [];

  if (q.fullNorm.length >= 2) {
    collectMatchesInMapped(mapped, q.fullNorm, false, ranges);
  }
  if (!q.trimmed.includes(" ") && q.fullCompact.length >= 2) {
    collectMatchesInMapped(mapped, q.fullCompact, true, ranges);
  }

  for (const tok of q.tokens) {
    const before = ranges.length;
    if (tok.norm) collectMatchesInMapped(mapped, tok.norm, false, ranges);
    if ((ranges.length === before || tok.compact !== tok.norm) && tok.compact.length >= 2) {
      collectMatchesInMapped(mapped, tok.compact, true, ranges);
    }
  }

  return mergeRanges(ranges);
}

function renderHighlighted(raw: string, q: ParsedQuery | null): ReactNode {
  if (!raw || !q) return raw;
  const ranges = findHighlightRanges(raw, q);
  if (!ranges.length) return raw;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (let i = 0; i < ranges.length; i++) {
    const [s, e] = ranges[i];
    if (s > cursor) nodes.push(raw.slice(cursor, s));
    nodes.push(
      <mark key={i} className="ib-search-hl">
        {raw.slice(s, e)}
      </mark>,
    );
    cursor = e;
  }
  if (cursor < raw.length) nodes.push(raw.slice(cursor));
  return nodes;
}

function buildContextualSnippet(item: PreparedItem, q: ParsedQuery): string | null {
  const missingTokens = q.tokens.filter(
    (tok) =>
      matchField(item.nTitle, item.cTitle, tok) === 0 &&
      matchField(item.nBadge, item.cBadge, tok) === 0 &&
      matchField(item.nSub, item.cSub, tok) === 0,
  );

  if (item.subtitle && missingTokens.length === 0) return null;

  const text = item.text;
  if (!text) return null;

  let anchorRanges: Range[] = [];
  if (missingTokens.length > 0) {
    const subQ: ParsedQuery = {
      trimmed: missingTokens.map((t) => t.raw).join(" "),
      fullNorm: missingTokens[0].norm,
      fullCompact: missingTokens[0].compact,
      tokens: missingTokens,
    };
    anchorRanges = findHighlightRanges(text, subQ);
  }
  if (!anchorRanges.length) {
    anchorRanges = findHighlightRanges(text, q);
  }
  if (!anchorRanges.length) return null;

  const [mStart, mEnd] = anchorRanges[0];
  let winStart = Math.max(0, mStart - 46);
  let winEnd = Math.min(text.length, Math.max(mEnd + 96, winStart + 145));

  if (winStart > 0) {
    const sp = text.indexOf(" ", winStart);
    if (sp !== -1 && sp < mStart && sp - winStart < 18) winStart = sp + 1;
  }
  if (winEnd < text.length) {
    const sp = text.lastIndexOf(" ", winEnd);
    if (sp > mEnd && winEnd - sp < 22) winEnd = sp;
  }

  const slice = text.slice(winStart, winEnd).trim();
  if (!slice) return null;
  return `${winStart > 0 ? "… " : ""}${slice}${winEnd < text.length ? " …" : ""}`;
}

function prepareItems(rawItems: SearchIndexItem[]): PreparedItem[] {
  return rawItems.map((item) => {
    const scope: PreparedItem["scope"] = item.type === "info" ? "katalog" : item.type;
    const t = toNormAndCompact(item.title);
    const b = toNormAndCompact(item.badge ?? "");
    const s = toNormAndCompact(item.subtitle ?? "");
    const x = toNormAndCompact(item.text);
    const all = toNormAndCompact([item.title, item.badge ?? "", item.subtitle ?? "", item.text].join(" · "));
    return {
      ...item,
      scope,
      nTitle: t.norm,
      cTitle: t.compact,
      nBadge: b.norm,
      cBadge: b.compact,
      nSub: s.norm,
      cSub: s.compact,
      nText: x.norm,
      cText: x.compact,
      nAll: all.norm,
      cAll: all.compact,
    };
  });
}

async function ensureSearchIndex(): Promise<PreparedItem[]> {
  if (cachedItems) return cachedItems;
  if (!inflightFetch) {
    inflightFetch = fetch("/api/search")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ items?: SearchIndexItem[] }>;
      })
      .then((data) => {
        const prepared = prepareItems(Array.isArray(data.items) ? data.items : []);
        cachedItems = prepared;
        return prepared;
      })
      .finally(() => {
        inflightFetch = null;
      });
  }
  return inflightFetch;
}

const ICON_PATHS: Record<SearchItemType, string> = {
  produk: "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z M3.3 7 12 12l8.7-5 M12 22V12",
  sampel: "M12 2 21 7v10l-9 5-9-5V7l9-5Z M12 12l9-5 M12 12v10 M12 12 3 7",
  area: "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z M12 10m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0",
  katalog: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z",
  info: "M12 12m-9 0a9 9 0 1 0 18 0 9 9 0 1 0-18 0 M12 16v-4 M12 8h.01",
  artikel: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
};

function TypeIcon({ type }: { type: SearchItemType }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON_PATHS[type]} />
    </svg>
  );
}

function SuggestionChips({ onSelect }: { onSelect: (q: string) => void }) {
  return (
    <div className="ib-search-chips">
      {QUICK_SUGGESTIONS.map((sug) => (
        <button key={sug.label} type="button" className="ib-search-chip" onClick={() => onSelect(sug.query)}>
          {sug.label}
        </button>
      ))}
    </div>
  );
}

export function HomeSearch({ whatsapp }: { whatsapp: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [items, setItems] = useState<PreparedItem[] | null>(() => cachedItems);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isMac, setIsMac] = useState(false);
  const [ph, setPh] = useState<{ cur: number; prev: number | null }>({ cur: 0, prev: null });
  const [reducedMotion, setReducedMotion] = useState(false);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const loadIndex = useCallback(() => {
    if (cachedItems) {
      setItems(cachedItems);
      setLoadError(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    ensureSearchIndex()
      .then((res) => {
        setItems(res);
      })
      .catch(() => {
        setLoadError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const openModal = useCallback(() => {
    setOpen(true);
    loadIndex();
  }, [loadIndex]);

  const closeModal = useCallback(() => {
    const dlg = dialogRef.current;
    if (dlg?.open) dlg.close();
    setOpen(false);
  }, []);

  useEffect(() => {
    if (typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)) {
      setIsMac(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReducedMotion(mq.matches);
      if (mq.matches) {
        setPh((s) => (s.prev === null ? s : { cur: s.cur, prev: null }));
      }
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (open || reducedMotion) {
      setPh((s) => (s.prev === null ? s : { cur: s.cur, prev: null }));
      return;
    }
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setPh((s) => ({
        cur: (s.cur + 1) % PLACEHOLDER_QUERIES.length,
        prev: s.cur,
      }));
    }, 4500);
    return () => window.clearInterval(id);
  }, [open, reducedMotion]);

  useEffect(() => {
    if (ph.prev === null) return;
    const t = window.setTimeout(() => {
      setPh((s) => (s.prev === null ? s : { cur: s.cur, prev: null }));
    }, 420);
    return () => window.clearTimeout(t);
  }, [ph.prev]);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open) {
      if (!dlg.open) dlg.showModal();
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (dlg.open) {
      dlg.close();
    }
  }, [open]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const modK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k";
      if (modK) {
        e.preventDefault();
        if (open) closeModal();
        else openModal();
        return;
      }
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !open) {
        const el = document.activeElement as HTMLElement | null;
        const tag = el?.tagName;
        if (el && (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable)) return;
        e.preventDefault();
        openModal();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, openModal, closeModal]);

  const parsedQuery = useMemo(() => parseQuery(query), [query]);

  const { scopeCounts, visibleItems, totalMatchedInScope } = useMemo(() => {
    const counts: Record<SearchScope, number> = {
      all: 0,
      produk: 0,
      sampel: 0,
      artikel: 0,
      area: 0,
      katalog: 0,
    };

    if (!items) {
      return { scopeCounts: counts, visibleItems: [] as PreparedItem[], totalMatchedInScope: 0 };
    }

    if (!parsedQuery) {
      for (const it of items) {
        counts.all++;
        counts[it.scope]++;
      }
      const list =
        scope === "all"
          ? items.filter((it) => it.type === "produk" || it.id.startsWith("tool-") || it.id === "area-index" || it.id === "katalog-1").slice(0, 12)
          : items.filter((it) => it.scope === scope).slice(0, MAX_RESULTS);
      return { scopeCounts: counts, visibleItems: list, totalMatchedInScope: scope === "all" ? counts.all : counts[scope] };
    }

    const scoredAll: { item: PreparedItem; score: number }[] = [];
    for (const it of items) {
      const sc = scoreItem(it, parsedQuery);
      if (sc >= 0) {
        counts.all++;
        counts[it.scope]++;
        if (scope === "all" || it.scope === scope) {
          scoredAll.push({ item: it, score: sc });
        }
      }
    }

    scoredAll.sort((a, b) => b.score - a.score);
    return {
      scopeCounts: counts,
      visibleItems: scoredAll.slice(0, MAX_RESULTS).map((x) => x.item),
      totalMatchedInScope: scoredAll.length,
    };
  }, [items, parsedQuery, scope]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query, scope]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const row = listRef.current.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open]);

  const navigateTo = useCallback(
    (url: string) => {
      closeModal();
      if (url.startsWith("/#") && typeof window !== "undefined" && window.location.pathname === "/") {
        const el = document.getElementById(url.slice(2));
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
          return;
        }
      }
      router.push(url);
    },
    [closeModal, router],
  );

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!visibleItems.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((prev) => (prev + 1) % visibleItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((prev) => (prev - 1 + visibleItems.length) % visibleItems.length);
    } else if (e.key === "Enter") {
      const chosen = visibleItems[activeIdx];
      if (chosen) {
        e.preventDefault();
        navigateTo(chosen.url);
      }
    }
  };

  const animatePlaceholder = !open && !reducedMotion;

  return (
    <div className="ib-search-wrap">
      <button
        type="button"
        className="ib-search-trigger"
        onClick={openModal}
        onFocus={loadIndex}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg className="ib-search-trigger-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7.5" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <span className="ib-search-trigger-text">
          <span className="ib-search-trigger-prefix">Cari: </span>
          <span className="ib-search-ticker">
            {animatePlaceholder && ph.prev !== null && (
              <span key={`out-${ph.prev}`} className="ib-search-ph is-leave" aria-hidden="true">
                {PLACEHOLDER_QUERIES[ph.prev]}
              </span>
            )}
            <span
              key={`cur-${ph.cur}`}
              className={`ib-search-ph${animatePlaceholder && ph.prev !== null ? " is-enter" : ""}`}
            >
              {PLACEHOLDER_QUERIES[ph.cur]}
            </span>
          </span>
        </span>
        <span className="sr-only"> — Buka pencarian seluruh situs</span>
        <span className="ib-search-kbd-group" aria-hidden="true">
          <kbd className="ib-search-kbd">/</kbd>
          <kbd className="ib-search-kbd">{isMac ? "⌘K" : "Ctrl K"}</kbd>
        </span>
      </button>

      <dialog
        ref={dialogRef}
        className="ib-search-dialog"
        aria-label="Pencarian seluruh situs Istana Block"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) closeModal();
        }}
      >
        {open && (
          <>
            <div className="ib-search-head">
              <span className="ib-search-head-ico" aria-hidden="true">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7.5" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </span>
              <input
                ref={inputRef}
                type="search"
                className="ib-search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Ketik produk, ukuran (40×40, 8 cm), mutu (K-350), kota, atau topik…"
                aria-label="Kata kunci pencarian"
                autoComplete="off"
                spellCheck={false}
              />
              {query && (
                <button
                  type="button"
                  className="ib-search-clear"
                  aria-label="Hapus kata kunci"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                >
                  ×
                </button>
              )}
              <button
                type="button"
                className="ib-search-close"
                aria-label="Tutup pencarian"
                onClick={closeModal}
              >
                Esc
              </button>
            </div>

            <div className="ib-search-tabs" role="tablist" aria-label="Filter kategori hasil">
              {SCOPE_TABS.map((tab) => {
                const active = scope === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`ib-search-tab${active ? " is-active" : ""}`}
                    onClick={() => {
                      setScope(tab.id);
                      inputRef.current?.focus();
                    }}
                  >
                    <span>{tab.label}</span>
                    {items && <span className="ib-search-tab-count">{scopeCounts[tab.id]}</span>}
                  </button>
                );
              })}
            </div>

            <div className="ib-search-body">
              {loading && !items ? (
                <div className="ib-search-skeleton" aria-label="Menyiapkan indeks pencarian">
                  <div className="ib-search-skel-row" />
                  <div className="ib-search-skel-row" />
                  <div className="ib-search-skel-row" />
                </div>
              ) : loadError && !items ? (
                <div className="ib-search-empty">
                  <h3>Indeks pencarian belum tersedia saat ini</h3>
                  <p>Periksa koneksi Anda lalu coba muat ulang, atau hubungi admin via WhatsApp.</p>
                  <div className="ib-search-empty-actions">
                    <button type="button" className="btn btn-blue btn-sm" onClick={loadIndex}>
                      Coba lagi
                    </button>
                    <a
                      className="btn btn-primary btn-sm"
                      href={waLink(whatsapp, "Halo Istana Block, saya mau tanya info produk dan harga.")}
                      target="_blank"
                      rel="noopener"
                    >
                      Tanya via WhatsApp
                    </a>
                  </div>
                </div>
              ) : (
                <>
                  {!parsedQuery && scope === "all" && (
                    <>
                      <div className="ib-search-section-label">Pencarian populer</div>
                      <SuggestionChips
                        onSelect={(q) => {
                          setQuery(q);
                          inputRef.current?.focus();
                        }}
                      />
                      <div className="ib-search-section-label">Akses cepat produk &amp; alat</div>
                    </>
                  )}

                  {visibleItems.length > 0 ? (
                    <>
                      <ul ref={listRef} className="ib-search-list" aria-label="Daftar hasil pencarian">
                        {visibleItems.map((item, idx) => {
                          const isActive = idx === activeIdx;
                          const snippet = parsedQuery ? buildContextualSnippet(item, parsedQuery) : null;
                          return (
                            <li key={item.id}>
                              <Link
                                href={item.url}
                                prefetch={false}
                                data-idx={idx}
                                className={`ib-search-item${isActive ? " is-active" : ""}`}
                                onMouseEnter={() => setActiveIdx(idx)}
                                onClick={(e) => {
                                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                                  e.preventDefault();
                                  navigateTo(item.url);
                                }}
                              >
                                <span className={`ib-search-type-ico is-${item.type}`}>
                                  <TypeIcon type={item.type} />
                                </span>
                                <span className="ib-search-item-main">
                                  <span className="ib-search-item-top">
                                    <span className="ib-search-item-title">
                                      {renderHighlighted(item.title, parsedQuery)}
                                    </span>
                                    <span className="ib-search-badge">
                                      {item.typeLabel}
                                      {item.badge ? " · " : ""}
                                      {item.badge ? renderHighlighted(item.badge, parsedQuery) : null}
                                    </span>
                                  </span>
                                  {item.subtitle && (
                                    <span className="ib-search-item-sub">
                                      {renderHighlighted(item.subtitle, parsedQuery)}
                                    </span>
                                  )}
                                  {snippet && (
                                    <span className="ib-search-snippet">
                                      {renderHighlighted(snippet, parsedQuery)}
                                    </span>
                                  )}
                                </span>
                                <span className="ib-search-item-aside" aria-hidden="true">
                                  <span className="ib-search-url">{item.url}</span>
                                  <span className="ib-search-enter">↵ Buka</span>
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                      {totalMatchedInScope > visibleItems.length && (
                        <div className="ib-search-more-note">
                          Menampilkan {visibleItems.length} dari {totalMatchedInScope} kecocokan. Persempit kata kunci atau pilih tab kategori.
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="ib-search-empty">
                      <h3>Tidak ada hasil untuk “{parsedQuery?.trimmed ?? query}”</h3>
                      <p>
                        {scope !== "all" && scopeCounts.all > 0
                          ? `Ditemukan ${scopeCounts.all} hasil di kategori lain. Coba tampilkan semua kategori.`
                          : "Coba kata kunci lain (mis. ukuran, mutu beton, nama kota) atau tanyakan langsung ke admin."}
                      </p>
                      <div className="ib-search-empty-actions">
                        {scope !== "all" && scopeCounts.all > 0 && (
                          <button
                            type="button"
                            className="btn btn-blue btn-sm"
                            onClick={() => {
                              setScope("all");
                              inputRef.current?.focus();
                            }}
                          >
                            Lihat {scopeCounts.all} hasil di Semua
                          </button>
                        )}
                        <a
                          className="btn btn-primary btn-sm"
                          href={waLink(
                            whatsapp,
                            `Halo Istana Block, saya mencari informasi tentang "${parsedQuery?.trimmed ?? query}". Mohon bantuannya.`,
                          )}
                          target="_blank"
                          rel="noopener"
                        >
                          Tanya via WhatsApp →
                        </a>
                      </div>
                      <SuggestionChips
                        onSelect={(q) => {
                          setScope("all");
                          setQuery(q);
                          inputRef.current?.focus();
                        }}
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="ib-search-foot">
              <div className="ib-search-foot-keys" aria-hidden="true">
                <span><kbd className="ib-search-kbd">↑</kbd><kbd className="ib-search-kbd">↓</kbd> Pilih</span>
                <span><kbd className="ib-search-kbd">↵</kbd> Buka</span>
                <span><kbd className="ib-search-kbd">Esc</kbd> Tutup</span>
              </div>
              <span>
                {items ? `${items.length} konten situs terindeks` : "Pencarian seluruh situs Istana Block"}
              </span>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
