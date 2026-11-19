import { PAVING_CATALOG } from "../catalog";
import { fmt, waMessage } from "../legacy/calculator";
import { LABEL_BEBAN } from "./konstanta-sementara";
import type { HasilProyek } from "./proyek";

const rp = (n: number) => `Rp${fmt(n, 0)}`;

/**
 * Baris teks daftar belanja untuk pesan WhatsApp (gaya detailLines: bullet "•" dan sub-baris "–").
 * Angka bertanda "*" memakai konstanta sementara dan diberi catatan di akhir.
 */
export function daftarBelanjaLines(h: HasilProyek): string[] {
  const lines: string[] = [];
  if (h.areas.length === 0 || h.totalLuasBersihM2 <= 0) return ["• Area: belum diisi"];

  lines.push(`• Total luas bersih: ${fmt(h.totalLuasBersihM2)} m²`);
  for (const a of h.areas) {
    lines.push(
      `• ${a.label}: ${PAVING_CATALOG[a.produkId].name}, tebal ${a.tebalCm} cm, ${LABEL_BEBAN[a.kelas].toLowerCase()}`,
      `   – ${fmt(a.luasBersihM2)} m² → ${fmt(a.pcsBeli)} pcs (termasuk sisa potong ${fmt(a.sisaPersen)}%)`,
    );
  }
  lines.push(`• Total paving: ${fmt(h.totalPcsBeli)} pcs`);

  const m = h.material;
  lines.push(
    `• Pasir alas*: ${fmt(m.pasirAlasM3)} m³`,
    `• Sirtu / base course*: ${fmt(m.sirtuM3)} m³`,
    `• Abu batu pengisi nat*: ${fmt(m.abuNatM3)} m³`,
  );
  if (m.kanstinPcs > 0) lines.push(`• Kanstin*: ${fmt(m.kanstinPcs)} pcs`);

  const lg = h.logistik;
  lines.push(`• Pengiriman*: ${fmt(lg.paletTotal)} palet, ±${fmt(lg.beratTotalKg, 0)} kg, ${fmt(lg.trip)} trip truk ${lg.jenisTruk}`);

  if (h.biaya) {
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
export function daftarBelanjaWA(h: HasilProyek, link = ""): string {
  return waMessage(daftarBelanjaLines(h), link);
}
