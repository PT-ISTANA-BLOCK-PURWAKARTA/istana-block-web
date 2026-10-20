// Ekspor Excel di sisi klien (SheetJS). Aman dipakai di komponen "use client"; TANPA server-only.
// Pustaka xlsx dimuat dinamis saat tombol ditekan, sehingga tidak masuk bundel awal dan tidak membebani Worker.

export type SheetColumn = {
  /** Kunci di setiap baris data. */
  key: string;
  /** Judul kolom. */
  header: string;
  /** Lebar kolom (karakter); kosong = menyesuaikan isi. */
  width?: number;
};

export type SheetData = {
  /** Nama sheet (maks 31 huruf, tanpa : \ / ? * [ ]). */
  name: string;
  /** Judul di baris pertama sheet (opsional). */
  title?: string;
  columns: SheetColumn[];
  rows: Record<string, unknown>[];
};

const cellText = (v: unknown) => (v instanceof Date ? "dd/mm/yyyy hh:mm" : String(v ?? ""));
const safeName = (s: string) => s.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31) || "Sheet";

/** Buat berkas .xlsx dari beberapa sheet lalu unduh. fileName harus berakhiran .xlsx. */
export async function downloadWorkbook(fileName: string, sheets: SheetData[], options: { dateNF?: string } = {}) {
  const XLSX = await import("xlsx");
  const dateNF = options.dateNF ?? "dd/mm/yyyy hh:mm";
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const s of sheets) {
    const head = s.columns.map((c) => c.header);
    const body = s.rows.map((r) => s.columns.map((c) => (r[c.key] ?? null) as string | number | boolean | Date | null));
    const aoa: (string | number | boolean | Date | null)[][] = [];
    if (s.title) aoa.push([s.title], []);
    const headerRow = aoa.length; // indeks baris judul kolom (0-based)
    aoa.push(head, ...body);
    const ws = XLSX.utils.aoa_to_sheet(aoa, { dateNF, cellDates: true });
    ws["!cols"] = s.columns.map((c) => ({
      wch: c.width ?? Math.min(Math.max(c.header.length, ...s.rows.map((r) => cellText(r[c.key]).length), 6) + 2, 50),
    }));
    if (s.rows.length) {
      ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: headerRow, c: 0 }, e: { r: headerRow + s.rows.length, c: Math.max(0, s.columns.length - 1) } }) };
    }
    // Nama sheet harus unik di dalam satu berkas.
    let name = safeName(s.name);
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${safeName(s.name).slice(0, 28)} ${n}`;
    used.add(name.toLowerCase());
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  if (!wb.SheetNames.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Tidak ada data."]]), "Data");
  XLSX.writeFile(wb, fileName, { compression: true });
}
