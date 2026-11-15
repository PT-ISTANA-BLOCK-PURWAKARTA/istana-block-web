import type { ArticleCoverMeta } from "@/db/schema";

export const LEGACY_FALLBACK_COVER = "/img/artikel/sampul-panduan.webp";

export function isRealArticleCover(src: string | null | undefined): src is string {
  return Boolean(src && src.trim() && src.trim() !== LEGACY_FALLBACK_COVER);
}

/** Mengambil maks. `max` subjudul H2/H3 pertama dari isi Markdown sebagai ringkasan topik sampul. */
export function extractArticleTopics(markdown: string, max = 3): string[] {
  const out: string[] = [];
  for (const raw of markdown.split(/\r?\n/)) {
    const m = raw.match(/^#{2,3}\s+(.+?)\s*$/);
    if (!m) continue;
    const clean = m[1]
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[*_`~]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!clean || clean.length < 4) continue;
    const clipped = clean.length > 44 ? `${clean.slice(0, 42).replace(/\s+\S*$/, "")}…` : clean;
    if (!out.includes(clipped)) out.push(clipped);
    if (out.length >= max) break;
  }
  return out;
}

export function normalizeCoverTopicsInput(raw: string): string[] {
  return raw
    .split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((s) => (s.length > 44 ? `${s.slice(0, 42).replace(/\s+\S*$/, "")}…` : s));
}

export function sanitizeCoverMeta(
  meta: { title?: string; excerpt?: string; topics?: string[]; theme?: string } | null | undefined,
  allowedThemes: readonly string[],
): ArticleCoverMeta | null {
  if (!meta) return null;
  const title = meta.title?.trim() || undefined;
  const excerpt = meta.excerpt?.trim() || undefined;
  const topics = meta.topics?.map((t) => t.trim()).filter(Boolean).slice(0, 3);
  const theme =
    meta.theme && allowedThemes.includes(meta.theme) ? (meta.theme as ArticleCoverMeta["theme"]) : undefined;
  const out: ArticleCoverMeta = {};
  if (title) out.title = title;
  if (excerpt) out.excerpt = excerpt;
  if (topics && topics.length > 0) out.topics = topics;
  if (theme) out.theme = theme;
  return Object.keys(out).length ? out : null;
}

export type ResolvedArticleCover = {
  title: string;
  badgeCategory: string;
  themeCategory: string;
  excerpt: string;
  topics: string[];
  hasCustomOverride: boolean;
};

/** Gabungkan field artikel dengan kustomisasi sampul opsional agar situs & preview admin identik. */
export function resolveArticleCover({
  title,
  category,
  excerpt = "",
  content = "",
  coverMeta,
}: {
  title: string;
  category: string;
  excerpt?: string;
  content?: string;
  coverMeta?: ArticleCoverMeta | null;
}): ResolvedArticleCover {
  const customTitle = coverMeta?.title?.trim() || "";
  const customExcerpt = coverMeta?.excerpt?.trim() || "";
  const customTopics = coverMeta?.topics?.map((t) => t.trim()).filter(Boolean).slice(0, 3);
  const customTheme = coverMeta?.theme?.trim() || "";

  return {
    title: customTitle || title.trim() || "Judul artikel Anda…",
    badgeCategory: category,
    themeCategory: customTheme || category,
    excerpt: customExcerpt || excerpt.trim(),
    topics: customTopics && customTopics.length > 0 ? customTopics : extractArticleTopics(content, 3),
    hasCustomOverride: Boolean(
      customTitle || customExcerpt || (customTopics && customTopics.length > 0) || customTheme,
    ),
  };
}

export type CategoryTheme = {
  code: string;
  bgFrom: string;
  bgTo: string;
  accent: string;
  tint: string;
};

const THEMES: Record<string, CategoryTheme> = {
  "Paving & Grass Block": {
    code: "PAVING",
    bgFrom: "#0e2a6b",
    bgTo: "#1f4291",
    accent: "#fe5722",
    tint: "#e3e9f5",
  },
  "Genteng & Atap": {
    code: "ATAP",
    bgFrom: "#152a54",
    bgTo: "#274785",
    accent: "#ff6b35",
    tint: "#ffe6dc",
  },
  "U-Ditch & Saluran": {
    code: "DRAINASE",
    bgFrom: "#0c2b4d",
    bgTo: "#164d80",
    accent: "#38bdf8",
    tint: "#e0f2fe",
  },
  "Buis & Gorong-gorong": {
    code: "BUIS BETON",
    bgFrom: "#102857",
    bgTo: "#1f4287",
    accent: "#fb923c",
    tint: "#ffedd5",
  },
  Kanstin: {
    code: "KANSTIN",
    bgFrom: "#162447",
    bgTo: "#283e75",
    accent: "#fbbf24",
    tint: "#fef3c7",
  },
  "Beton Cor & Konstruksi": {
    code: "KONSTRUKSI",
    bgFrom: "#0f2352",
    bgTo: "#223f82",
    accent: "#fe5722",
    tint: "#e3e9f5",
  },
};

const DEFAULT_THEME: CategoryTheme = {
  code: "PANDUAN",
  bgFrom: "#0e2a6b",
  bgTo: "#1f4291",
  accent: "#fe5722",
  tint: "#e3e9f5",
};

export function categoryCoverTheme(category: string): CategoryTheme {
  return THEMES[category] ?? DEFAULT_THEME;
}
