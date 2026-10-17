/** Ikon bilah alat editor (garis 1,8 px, 24 × 24). */
const PATHS = {
  bold: "M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z",
  italic: "M10 5h8M6 19h8M14.5 5l-5 14",
  strike: "M5 12h14M16.5 7.5C16 6 14.4 5 12 5c-2.8 0-4.5 1.4-4.5 3.3 0 1.4.9 2.4 2.6 3M8 16.5c.6 1.6 2.3 2.5 4.3 2.5 2.8 0 4.7-1.4 4.7-3.4 0-.6-.1-1.1-.4-1.6",
  ul: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  ol: "M10 6h10M10 12h10M10 18h10M4 5l1.5-1v5M3.8 14.2c.3-.6.9-1 1.6-1 1 0 1.6.6 1.6 1.4 0 1.2-3.2 2.2-3.2 3.9h3.3",
  quote: "M7 7h4v5H7.5L6 17M15 7h4v5h-3.5L14 17",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2",
  image: "M4 5h16v14H4zM4 15.5l4.5-4.5 4 4 2.5-2.5L20 17.5M15 9.2h.01",
  table: "M4 5h16v14H4zM4 10h16M4 14.5h16M10 10v9M15 10v9",
  hr: "M4 12h16M8 7h8M8 17h8",
  undo: "M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  redo: "M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13",
  upload: "M12 16V4M7 9l5-5 5 5M5 15v4h14v-4",
  history: "M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4M12 8v4.5l3 1.8",
} as const;

export type GlyphName = keyof typeof PATHS;

export function Glyph({ name, size = 18 }: { name: GlyphName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} fill="none" stroke="currentColor" strokeWidth={name === "bold" ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
