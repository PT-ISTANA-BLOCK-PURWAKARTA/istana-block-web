// Excel form ISO dalam format file F-IB: judul (baris 1-3), header baris 4, keterangan baris 5, data mulai baris 6.
// Nama file & nama sheet sama dengan file form, jadi bisa langsung mengganti file di folder audit
// (file "Rekap Form Audit SNI" membaca kolom tanggal B6:B505 tiap sheet F-IB).
// Khusus klien: pustaka xlsx dimuat dinamis saat tombol ditekan (tidak membebani Worker).
import { ENVIRONMENT_LIMITS, FORM_BY_CODE, ISO_CODES, SNI_PAVING, type IsoCode, type IsoColumn, type IsoForm, type IsoValues } from "@/lib/ops/shared/isoForms";
import { OBJECTIVE_GROUPS } from "@/lib/ops/shared/isoObjectives";
import { dashboardItems, objectiveRows, objectiveSummary, RECAP_LINES, rangeText, type DayRange, type IsoOverview } from "@/lib/ops/shared/isoRecap";

type XLSXModule = typeof import("xlsx");
type Sheet = import("xlsx").WorkSheet;
export type ExportRow = { number: string | null; values: IsoValues };
export type ExportMeta = DayRange & { printedBy: string; printedAt: Date };

const NOTICE = "DOKUMEN INTERNAL - penggandaan & distribusi form ini harus seizin manajemen PT Istana Block Purwakarta; form cetak tanpa No. Seri Cetak dianggap TIDAK TERKENDALI.";
const ISSUED = "15/10/2026";
const NUMBER_FORMATS = { percent: "0.0%", decimal1: "0.0", decimal2: "0.00", integer: "0" } as const;

/** Nomor seri tanggal Excel (tanpa geser zona waktu). */
const serial = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / 86_400_000 + 25569;
const printed = (meta: ExportMeta) => meta.printedAt.toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

function cell(column: IsoColumn, value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (column.type === "date" && typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return { t: "n", v: serial(value), z: "dd/mm/yyyy" };
  if (typeof value === "number") return column.format ? { t: "n", v: value, z: NUMBER_FORMATS[column.format] } : value;
  return String(value);
}

/** Kolom form: kolom resmi dulu, kolom tambahan aplikasi di paling kanan. */
const exportColumns = (form: IsoForm) => [...form.columns.filter((column) => !column.extra), ...form.columns.filter((column) => column.extra)];

export function formSheet(XLSX: XLSXModule, form: IsoForm, rows: ExportRow[], meta: ExportMeta): Sheet {
  const columns = exportColumns(form);
  const width = columns.length + 1;
  const aoa: unknown[][] = [
    [form.title, ...Array(width - 2).fill(null), "No. Seri Cetak:"],
    [`Kode: ${form.code} | Rev. 00 | Tgl Terbit: ${ISSUED} | Klausul ISO 9001:2015: ${form.clause} | Prosedur: ${form.procedure} | Menggantikan: ${form.replaces}`],
    [NOTICE],
    [form.numberLabel, ...columns.map((column) => column.label)],
    ["Periode", `${rangeText(meta)} · dicetak dari aplikasi Istana Block ${printed(meta)} oleh ${meta.printedBy} · ${rows.length} rekaman${form.master ? " (daftar induk: semua alat)" : ""}`],
    ...rows.map((row, index) => [row.number ?? index + 1, ...columns.map((column) => cell(column, row.values[column.key]))]),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, width - 2) } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: width - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: width - 1 } },
    { s: { r: 4, c: 1 }, e: { r: 4, c: width - 1 } },
  ];
  sheet["!cols"] = [{ wch: form.code === "F-IB-15" ? 14 : 7 }, ...columns.map((column) => ({ wch: column.width ?? Math.min(Math.max(column.label.length + 2, 11), 20) }))];
  if (rows.length) sheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 3, c: 0 }, e: { r: 4 + rows.length, c: width - 1 } }) };
  return sheet;
}

function standardSheet(XLSX: XLSXModule) {
  return XLSX.utils.aoa_to_sheet([
    ["STANDAR ACUAN UNTUK PERHITUNGAN OTOMATIS"],
    [],
    ["A. SNI 03-0691-1996 Bata Beton (Paving Block) - syarat fisik per mutu"],
    ["Mutu", "Kuat Tekan Rata-rata Min (MPa)", "Kuat Tekan Individu Min (MPa)", "Penyerapan Air Rata-rata Maks (%)", "Contoh Penggunaan"],
    ...Object.entries(SNI_PAVING).map(([grade, value]) => [grade, value.strength, value.strengthMin, value.absorption, value.use]),
    ["Uji kuat tekan internal dari aplikasi memakai mutu K (kg/cm²) dan batas sesuai umur benda uji (tabel standar form uji tekan)."],
    [],
    ["B. Standar lingkungan kerja"],
    ["Parameter", "Batas Min", "Batas Maks", "Satuan"],
    ...Object.entries(ENVIRONMENT_LIMITS).map(([name, value]) => [name, value.min, value.max, value.unit]),
  ]);
}

const percentCell = (value: number | null) => (value === null ? "-" : { t: "n", v: value, z: "0.0%" });
const lineCell = (value: number | null, format?: string) => (value === null ? null : format ? { t: "n", v: value, z: NUMBER_FORMATS[format as keyof typeof NUMBER_FORMATS] } : value);

function summarySheet(XLSX: XLSXModule, overview: IsoOverview, monthly: { label: string; overview: IsoOverview }[], meta: ExportMeta) {
  const months = monthly.length > 1 ? monthly : [];
  const aoa: unknown[][] = [
    ["REKAP FORM MUTU ISO 9001:2015 & SNI - PT ISTANA BLOCK PURWAKARTA"],
    [`Periode ${rangeText(meta)} · dicetak dari aplikasi ${printed(meta)} oleh ${meta.printedBy}`],
    [],
    ["DASHBOARD"],
    ...dashboardItems(overview).map((item) => [item.label, item.format === "percent" ? percentCell(item.value) : lineCell(item.value, item.format), item.hint ?? ""]),
    [],
    ["REKAP PER FORM & INDIKATOR"],
    ["Uraian", "Sumber", ...months.map((month) => month.label), "Total periode"],
  ];
  for (const line of RECAP_LINES) {
    if (line.section) aoa.push([line.section]);
    aoa.push([line.label, line.code ? FORM_BY_CODE[line.code as IsoCode].fileName : line.source, ...months.map((month) => lineCell(line.value(month.overview), line.format)), lineCell(line.value(overview), line.format)]);
  }
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet["!cols"] = [{ wch: 38 }, { wch: 40 }, ...months.map(() => ({ wch: 9 })), { wch: 13 }];
  return sheet;
}

function objectivesSheet(XLSX: XLSXModule, overview: IsoOverview, meta: ExportMeta) {
  const rows = objectiveRows(overview);
  const summary = objectiveSummary(rows);
  const aoa: unknown[][] = [
    ["PT ISTANA BLOCK PURWAKARTA", null, null, null, null, null, null, "No. Dokumen", ": F-IB-16"],
    ["FORM SASARAN MUTU", null, null, null, null, null, null, "No. Revisi", ": 00"],
    [null, null, null, null, null, null, null, "Tgl Terbit", ": 15 Oktober 2026"],
    ["Produk Precast: Paving Press Hydraulic · U-Ditch · Kanstin Wetcast · Buis Beton (Vibrasi & Tumbuk) · Greffel Tumbuk", null, null, null, null, null, null, "Periode", `: ${rangeText(meta)}`],
    [NOTICE],
    [],
    ["No", "Sasaran Mutu", "Target", "Dasar Perhitungan", "Periode", "Penanggung Jawab", "Jumlah Total", "Jumlah Tercapai", "% Tercapai", "Status", "Sumber Data"],
  ];
  for (const group of OBJECTIVE_GROUPS) {
    aoa.push([group.title]);
    for (const row of rows.filter((item) => item.group === group.id)) {
      aoa.push([
        row.no, row.text, { t: "n", v: row.target, z: row.target === 1 ? "0%" : "0.0%" }, row.basis, row.period, row.pic, row.total, row.achieved,
        row.percent === null ? null : { t: "n", v: row.percent, z: "0.0%" }, row.status,
        row.source === "auto" ? `Otomatis: ${row.dataSource ?? "data aplikasi"}` : row.source === "manual" ? `Isian manual (${row.months.join(", ")})` : "Belum diisi",
      ]);
    }
  }
  aoa.push(
    [],
    [`Ringkasan periode: ${summary.reached} dari ${rows.length} sasaran TERCAPAI | belum tercapai: ${summary.missed} | belum diisi: ${summary.empty}`],
    [],
    ["Dibuat oleh", null, null, "Diperiksa oleh", null, null, "Disetujui oleh"],
    ["Quality Control", null, null, "Manajer Perusahaan", null, null, "Pimpinan"],
    [], [],
    ["Nama :", null, null, "Nama :", null, null, "Nama :"],
    ["Tanggal :", null, null, "Tanggal :", null, null, "Tanggal :"],
  );
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet["!cols"] = [{ wch: 5 }, { wch: 52 }, { wch: 8 }, { wch: 40 }, { wch: 14 }, { wch: 22 }, { wch: 11 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 44 }];
  return sheet;
}

/** Satu file form, nama file & sheet sama dengan file aslinya. */
export async function downloadFormFile(form: IsoForm, rows: ExportRow[], meta: ExportMeta) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, formSheet(XLSX, form, rows, meta), form.code);
  if (form.code === "F-IB-04" || form.code === "F-IB-05") XLSX.utils.book_append_sheet(workbook, standardSheet(XLSX), "Standar");
  XLSX.writeFile(workbook, form.fileName, { compression: true });
}

/** Semua form dalam satu file: Ringkasan, Sasaran Mutu, F-IB-01 ... F-IB-15, Standar. */
export async function downloadAllForms(input: { overview: IsoOverview; monthly: { label: string; overview: IsoOverview }[]; forms: { code: IsoCode; rows: ExportRow[] }[]; meta: ExportMeta }) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, summarySheet(XLSX, input.overview, input.monthly, input.meta), "Ringkasan");
  XLSX.utils.book_append_sheet(workbook, objectivesSheet(XLSX, input.overview, input.meta), "Sasaran Mutu (F-IB-16)");
  for (const code of ISO_CODES) {
    const item = input.forms.find((form) => form.code === code);
    if (item) XLSX.utils.book_append_sheet(workbook, formSheet(XLSX, FORM_BY_CODE[code], item.rows, input.meta), code);
  }
  XLSX.utils.book_append_sheet(workbook, standardSheet(XLSX), "Standar");
  XLSX.writeFile(workbook, `Rekap Form ISO ${input.meta.from} sd ${input.meta.to}.xlsx`, { compression: true });
}
