// Excel rapi bergaya formulir perusahaan (sama dengan app lama, client/src/lib/styledExcel.ts): kop surat (logo +
// nama perusahaan + alamat), tabel bergaris tebal, header abu-abu tebal, footer cetak. Hanya untuk komponen "use client".
// ExcelJS dimuat saat tombol ditekan dari aset statis /vendor (seperti SheetJS di lib/ops/excel.ts), jadi tidak ikut
// bundel awal maupun bundel server Worker. Paket npm `exceljs` (devDependency) hanya dipakai untuk tipe.
import type { Workbook, Worksheet } from "exceljs";

/** Salinan node_modules/exceljs/dist/exceljs.min.js; ganti berkas & versinya bersamaan bila exceljs dinaikkan. */
const EXCELJS_URL = "/vendor/exceljs-4.4.0.min.js";

export type Brand = { name: string; products?: string; address: string; phone: string; logo: string };

export const IB_BRAND: Brand = {
  name: "PT. ISTANA BLOCK PURWAKARTA",
  products: "Paving Block, Grass Block, Genteng Beton, Batako, U-Ditch, Buis Beton, Kanstin, Dll.",
  address: "Jl. Terusan Kapten Halim No. 121, Sawah Kulon, Kec. Pasawahan, Kab. Purwakarta, Jawa Barat 41172",
  phone: "(0264) 200476 · 0812 8177 7660 · 0878 8177 7660",
  logo: "/brand/logo-istana-block.png",
};
export const FOOTER_TEXT = "PT. Istana Block Purwakarta";

export type Cell = string | number | Date | null | undefined | { value: string | number | Date | null; numFmt?: string; bold?: boolean; color?: string };
export type Column = { header: string; width?: number; numFmt?: string; align?: "left" | "center" | "right" };

/** Format angka rupiah tanpa desimal; negatif dalam kurung. */
export const RP = '#,##0;(#,##0);"-"';

const THIN = { style: "thin" as const, color: { argb: "FF000000" } };
const MEDIUM = { style: "medium" as const, color: { argb: "FF000000" } };
const HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE4E7EB" } };

type ExcelJSGlobal = { Workbook: new () => Workbook };
let excelJs: Promise<ExcelJSGlobal> | null = null;
function loadExcelJS(): Promise<ExcelJSGlobal> {
  excelJs ??= new Promise<ExcelJSGlobal>((resolve, reject) => {
    const w = window as unknown as { ExcelJS?: ExcelJSGlobal };
    if (w.ExcelJS) return resolve(w.ExcelJS);
    const s = Object.assign(document.createElement("script"), { src: EXCELJS_URL, async: true });
    s.onload = () => (w.ExcelJS ? resolve(w.ExcelJS) : reject(new Error("ExcelJS tidak termuat")));
    s.onerror = () => { excelJs = null; reject(new Error("Gagal memuat pustaka Excel. Coba lagi.")); };
    document.head.appendChild(s);
  });
  return excelJs;
}

const logos = new Map<string, Promise<string | null>>();
/** Logo kop sebagai PNG base64 (gambar webp/png digambar ulang ke kanvas). */
function logoPng(src: string) {
  if (!logos.has(src)) {
    logos.set(src, (async () => {
      try {
        const blob = await fetch(src).then((r) => r.blob());
        const bitmap = await createImageBitmap(blob);
        const canvas = Object.assign(document.createElement("canvas"), { width: 240, height: 240 });
        const ctx = canvas.getContext("2d")!;
        const scale = Math.min(240 / bitmap.width, 240 / bitmap.height);
        ctx.drawImage(bitmap, (240 - bitmap.width * scale) / 2, (240 - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
        return canvas.toDataURL("image/png");
      } catch {
        return null;
      }
    })());
  }
  return logos.get(src)!;
}

export async function newWorkbook(company = FOOTER_TEXT) {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = company;
  workbook.company = company;
  workbook.created = new Date();
  return workbook;
}

/** Sheet baru dengan pengaturan cetak (A4, muat selebar halaman) dan footer perusahaan. */
export function addSheet(workbook: Workbook, name: string, landscape = true, footer = FOOTER_TEXT) {
  const safe = name.replace(/[\\/?*[\]:]/g, "-").slice(0, 31);
  let unique = safe, index = 2;
  while (workbook.getWorksheet(unique)) unique = `${safe.slice(0, 28)} ${index++}`;
  return workbook.addWorksheet(unique, {
    pageSetup: { paperSize: 9, orientation: landscape ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.2, footer: 0.25 } },
    headerFooter: { oddFooter: `&L&8${footer}&C&8Halaman &P dari &N&R&8Dicetak &D` },
    views: [{ showGridLines: false }],
  });
}

/**
 * Kop surat di baris 1–4 + garis ganda di bawahnya, lalu judul & keterangan. Mengembalikan baris kosong berikutnya.
 * `columns` = jumlah kolom tabel (untuk lebar kop).
 */
export async function addLetterhead(workbook: Workbook, sheet: Worksheet, columns: number, title: string, subtitle?: string, brand: Brand = IB_BRAND) {
  const last = Math.max(columns, 6);
  const logo = await logoPng(brand.logo);
  if (logo) {
    const imageId = workbook.addImage({ base64: logo, extension: "png" });
    sheet.addImage(imageId, { tl: { col: 0.15, row: 0.15 }, ext: { width: 64, height: 64 } });
  }
  const lines: [string, number, boolean][] = [[brand.name, 15, true], ...(brand.products ? [[brand.products, 9, false] as [string, number, boolean]] : []), [brand.address, 9, false], [`Telp. ${brand.phone}`, 9, false]];
  lines.forEach(([text, size, bold], index) => {
    const row = index + 1;
    sheet.mergeCells(row, 2, row, last);
    const cell = sheet.getCell(row, 2);
    cell.value = text;
    cell.font = { name: "Arial", size, bold, color: { argb: index === 0 ? "FF1F3441" : "FF333333" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(row).height = index === 0 ? 22 : 13;
  });
  const lineRow = Math.max(lines.length, 4);
  for (let col = 1; col <= last; col++) sheet.getCell(lineRow, col).border = { bottom: { style: "double", color: { argb: "FF000000" } } };
  const titleRow = lineRow + 2;
  sheet.mergeCells(titleRow, 1, titleRow, last);
  const titleCell = sheet.getCell(titleRow, 1);
  titleCell.value = title.toUpperCase();
  titleCell.font = { name: "Arial", size: 13, bold: true };
  titleCell.alignment = { horizontal: "center" };
  if (subtitle) {
    sheet.mergeCells(titleRow + 1, 1, titleRow + 1, last);
    const sub = sheet.getCell(titleRow + 1, 1);
    sub.value = subtitle;
    sub.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF444444" } };
    sub.alignment = { horizontal: "center" };
  }
  return titleRow + (subtitle ? 3 : 2);
}

const isDateValue = (value: unknown): value is Date => value instanceof Date && !Number.isNaN(value.getTime());

export function cellText(value: Cell): string {
  if (value === null || value === undefined) return "";
  if (isDateValue(value)) return "dd/mm/yyyy";
  if (typeof value === "object") return value.value === null ? "" : isDateValue(value.value) ? "dd/mm/yyyy" : String(value.value);
  return String(value);
}

/**
 * Tabel bergaris: header tebal abu-abu, garis luar & bawah header tebal (medium), garis dalam hitam tipis.
 * Mengembalikan baris setelah tabel.
 */
export function addTable(sheet: Worksheet, startRow: number, columns: Column[], rows: Cell[][], options: { dateFormat?: string; autoFilter?: boolean } = {}) {
  const header = sheet.getRow(startRow);
  columns.forEach((column, index) => {
    const cell = header.getCell(1 + index);
    cell.value = column.header;
    cell.font = { name: "Arial", size: 9.5, bold: true };
    cell.fill = HEADER_FILL;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = { top: MEDIUM, bottom: MEDIUM, left: index === 0 ? MEDIUM : THIN, right: index === columns.length - 1 ? MEDIUM : THIN };
    const current = sheet.getColumn(1 + index);
    const width = column.width ?? Math.min(Math.max(column.header.length + 3, ...rows.map((row) => cellText(row[index]).length + 2), 8), 48);
    if (!current.width || current.width < width) current.width = width;
  });
  header.height = 20;
  rows.forEach((values, rowIndex) => {
    const row = sheet.getRow(startRow + 1 + rowIndex);
    const lastRow = rowIndex === rows.length - 1;
    columns.forEach((column, index) => {
      const cell = row.getCell(1 + index);
      const raw = values[index];
      const spec = raw !== null && typeof raw === "object" && !isDateValue(raw) ? raw : null;
      const value = (spec ? spec.value : raw) as string | number | Date | null | undefined;
      cell.value = value === undefined ? null : value;
      const numFmt = spec?.numFmt ?? (isDateValue(value) ? options.dateFormat ?? "dd/mm/yyyy" : column.numFmt);
      if (numFmt) cell.numFmt = numFmt;
      cell.font = { name: "Arial", size: 9.5, bold: spec?.bold, color: spec?.color ? { argb: spec.color } : undefined };
      cell.alignment = { vertical: "top", wrapText: typeof value === "string" && value.length > 40, horizontal: column.align ?? (typeof value === "number" || isDateValue(value) ? "right" : "left") };
      cell.border = { top: THIN, bottom: lastRow ? MEDIUM : THIN, left: index === 0 ? MEDIUM : THIN, right: index === columns.length - 1 ? MEDIUM : THIN };
    });
  });
  if (!rows.length) {
    sheet.mergeCells(startRow + 1, 1, startRow + 1, columns.length);
    const cell = sheet.getCell(startRow + 1, 1);
    cell.value = "Tidak ada data pada periode ini";
    cell.font = { name: "Arial", size: 9.5, italic: true, color: { argb: "FF777777" } };
    cell.alignment = { horizontal: "center" };
    cell.border = { top: THIN, bottom: MEDIUM, left: MEDIUM, right: MEDIUM };
  }
  if (options.autoFilter && rows.length) sheet.autoFilter = { from: { row: startRow, column: 1 }, to: { row: startRow + rows.length, column: columns.length } };
  return startRow + Math.max(rows.length, 1) + 1;
}

/** Baris ringkasan "Label : nilai" tebal di bawah tabel (mis. Saldo Awal / Saldo Akhir / Mutasi). */
export function addSummary(sheet: Worksheet, row: number, labelCol: number, valueCol: number, items: [string, number][]) {
  items.forEach(([label, value], i) => {
    const l = sheet.getCell(row + i, labelCol);
    l.value = label;
    l.font = { name: "Arial", size: 9.5, bold: true };
    const v = sheet.getCell(row + i, valueCol);
    v.value = value;
    v.numFmt = RP;
    v.font = { name: "Arial", size: 9.5, bold: true, color: value < 0 ? { argb: "FFC62828" } : undefined };
    v.alignment = { horizontal: "right" };
  });
  return row + items.length + 1;
}

/** Simpan sebagai berkas .xlsx (unduhan di browser). */
export async function saveWorkbook(workbook: Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: filename.replace(/[\\/:*?"<>|]/g, "-") });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Tanggal "YYYY-MM-DD" sebagai tanggal Excel tanpa geser zona waktu. */
export const excelDay = (day: string) => new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))));
