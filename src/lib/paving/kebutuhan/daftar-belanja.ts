import { fmt, waMessage } from "../legacy/calculator";
import { rekomendasiBeban } from "./beban";
import { LABEL_BEBAN, TAMPILKAN_BIAYA } from "./konstanta-sementara";
import type { HasilProyek } from "./proyek";

const rp = (n: number) => `Rp${fmt(n, 0)}`;

export interface OpsiDaftarBelanja {
  /** Sirtu sudah dihitung oleh hitungan utama (base course); jangan ulangi. */
  tanpaSirtu?: boolean;
  /** Hitungan utama sudah memuat abu batu alas (lapisan alas 5 cm); pasir alas tidak ditambah lagi. */
  tanpaPasir?: boolean;
}

/** Tebal lapisan alas (cm) pada hitungan utama ("Abu batu alas 5 cm"). */
export const ALAS_UTAMA_CM = 5;

/**
 * Baris tambahan "Kebutuhan lapangan" untuk pesan WhatsApp (gaya detailLines: bullet "•").
 * Hanya memuat yang belum ada di hitungan utama: rekomendasi tebal/produk, pasir alas, sirtu, palet, trip,
 * berat. Jumlah paving, kanstin, dan abu batu TIDAK diulang. Angka bertanda "*" memakai konstanta sementara.
 */
export function daftarBelanjaLines(h: HasilProyek, opsi: OpsiDaftarBelanja = {}): string[] {
  const lines: string[] = [];
  if (h.areas.length === 0 || h.totalLuasBersihM2 <= 0) return lines;

  for (const a of h.areas) {
    const rek = rekomendasiBeban(a.kelas);
    const cocok = rek.produk.length > 0 ? `, produk cocok: ${rek.produk.map((p) => p.name).join(", ")}` : "";
    lines.push(`• Beban ${LABEL_BEBAN[a.kelas].toLowerCase()}: tebal minimal ${rek.tebalMinCm} cm${cocok}*`);
    for (const w of rek.peringatan) lines.push(`   – ${w}`);
  }

  const m = h.material;
  if (!opsi.tanpaPasir) {
    lines.push(`• Pasir alas*: ${fmt(m.pasirAlasM3)} m³`);
  } else {
    const tebal = h.areas[0].material.pasirAlas.tebalCm;
    if (tebal !== ALAS_UTAMA_CM) lines.push(`• Tebal alas disarankan ${fmt(tebal)} cm*`);
  }
  if (!opsi.tanpaSirtu) lines.push(`• Sirtu / base course*: ${fmt(m.sirtuM3)} m³`);

  const lg = h.logistik;
  lines.push(`• Pengiriman*: ${fmt(lg.paletTotal)} palet, ±${fmt(lg.beratTotalKg, 0)} kg, ${fmt(lg.trip)} trip truk ${lg.jenisTruk}`);

  if (TAMPILKAN_BIAYA && h.biaya) {
    for (const b of h.biaya.baris) {
      lines.push(`• ${b.label}${b.sementara ? "*" : ""}: ${fmt(b.qty)} ${b.satuan} × ${rp(b.hargaSatuan)} = ${rp(b.subtotal)}`);
    }
    lines.push(`• Perkiraan total*: ${rp(h.biaya.total)}`);
  }
  for (const w of h.peringatan) lines.push(`• Perhatian: ${w}`);
  lines.push("* Perkiraan sementara, menunggu konfirmasi pabrik.");
  return lines;
}

/** Pesan WA lengkap dengan salam standar dari waMessage yang sudah ada. */
export function daftarBelanjaWA(h: HasilProyek, link = "", opsi: OpsiDaftarBelanja = {}): string {
  return waMessage(daftarBelanjaLines(h, opsi), link);
}
