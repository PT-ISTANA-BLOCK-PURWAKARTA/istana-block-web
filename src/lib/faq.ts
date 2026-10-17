// Tanya-jawab beranda disimpan sebagai teks "Pertanyaan :: Jawaban" per baris (tanpa akses database,
// jadi aman diimpor oleh form di browser).

/** Kebalikan parseFaq: baris tanya-jawab → "Pertanyaan :: Jawaban" per baris. */
export function formatFaq(rows: { q?: unknown; a?: unknown }[]) {
  const clean = (v: unknown) => String(v ?? "").replace(/\s*\r?\n\s*/g, " ").trim();
  return rows
    .map((r) => ({ q: clean(r.q).replace(/::/g, ":"), a: clean(r.a) }))
    .filter((r) => r.q && r.a)
    .map((r) => `${r.q} :: ${r.a}`)
    .join("\n");
}

export function parseFaq(text: string | null | undefined): { q: string; a: string }[] {
  return String(text ?? "")
    .split(/\r?\n/)
    .map((line) => {
      const i = line.indexOf("::");
      if (i < 0) return null;
      return { q: line.slice(0, i).trim(), a: line.slice(i + 2).trim() };
    })
    .filter((x): x is { q: string; a: string } => !!x && !!x.q && !!x.a);
}
