// Format angka/tanggal gaya Indonesia untuk modul operasional (aman di server maupun klien).
// Untuk tanggal bisnis teks YYYY-MM-DD dan rupiah, pakai src/lib/erp/util.ts (tgl, formatAmount, ...).

/** Format Indonesia: titik = ribuan, koma = desimal, tanpa desimal bila bulat (1400 → "1.400", 75.64 → "75,64"). */
export function formatQuantity(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (value === null || value === undefined || value === "" || !Number.isFinite(number)) return "-";
  return number.toLocaleString("id-ID", { maximumFractionDigits: 3 });
}

export function formatLoad(quantity: unknown, unit?: string | null) {
  const amount = formatQuantity(quantity);
  return amount === "-" ? "-" : `${amount} ${unit || ""}`.trim();
}

/** Angka dengan batas desimal (default 2), "-" bila kosong. */
export const fmt = (value: number | null | undefined, digits = 2) => value === null || value === undefined ? "-" : value.toLocaleString("id-ID", { maximumFractionDigits: digits });

// Zona waktu dikunci ke WIB agar hasil sama di Worker (UTC) dan di browser.
export function formatDate(value: unknown, empty = "Belum dijadwalkan") {
  if (!value) return empty;
  return new Date(value as string).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
}

export function formatDateTime(value: unknown, empty = "-") {
  if (!value) return empty;
  return new Date(value as string).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
}

/** Nomor WhatsApp format internasional (08xx → 628xx). */
export function toWhatsAppNumber(phone: string | null | undefined) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}
