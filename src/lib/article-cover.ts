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
