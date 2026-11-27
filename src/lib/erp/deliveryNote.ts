// Surat jalan manual (ops_delivery_notes, padanan tab "Surat jalan" app lama) & kop per penerbit.
import type { Settings } from "@/lib/settings";
import type { SuratJalanKop } from "@/components/erp/SuratJalanSheet";

export const NOTE_ISSUERS = [
  { key: "ib", label: "PT. Istana Block Purwakarta", prefix: "SJ-IB-" },
  { key: "ibn", label: "CV. Istana Bangun Nusantara", prefix: "SJ-IBN-" },
  { key: "polos", label: "Tanpa kop (kosongan)", prefix: "SJ-K-" },
] as const;
/** SJ-IBN-M000068: nomor urut per penerbit (lanjut dari app lama). */
export const deliveryNoteNumber = (seq: number, issuer: string) => `${(NOTE_ISSUERS.find((i) => i.key === issuer) ?? NOTE_ISSUERS[0]).prefix}M${String(seq).padStart(6, "0")}`;

export type NoteLine = { name: string; quantity: number; unit: string; remark?: string | null };
/** Baris tersimpan bisa format app lama ({quantity}) atau format lama web ({qty}). */
export const noteLines = (items: Record<string, unknown>[]): NoteLine[] =>
  items.map((i) => ({ name: String(i.name ?? ""), quantity: Number(i.quantity ?? i.qty ?? 0), unit: String(i.unit ?? ""), remark: (i.remark ?? i.note ?? null) as string | null })).filter((l) => l.name);

/** Kop surat sesuai penerbit: Istana Block, CV. Istana Bangun Nusantara, Ekspedisi Istana Block, atau tanpa kop. */
export function kopOf(issuer: string, site: Settings): SuratJalanKop {
  const address = site.address || "";
  const phone = [site.phone_office, site.phone || site.whatsapp].filter(Boolean).join(" · ");
  if (issuer === "polos") return null;
  if (issuer === "ibn") return { name: "CV. ISTANA BANGUN NUSANTARA", logo: "/brand/logo-ibn.png", address, phone };
  if (issuer === "eib") return { name: "EKSPEDISI ISTANA BLOCK", logo: "/brand/logo-ekspedisi.png", address, phone };
  return { name: (site.legal_name || "PT. Istana Block Purwakarta").toUpperCase(), logo: "/brand/logo-istana-block.webp", address, phone };
}
