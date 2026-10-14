export function rupiah(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "";
  const s = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `Rp${s}`;
}

export function priceLabel(p: { priceFrom: number | null; priceTo: number | null; unit: string }) {
  if (p.priceFrom == null) return "Hubungi admin";
  if (p.priceTo != null && p.priceTo > p.priceFrom) return `${rupiah(p.priceFrom)}–${rupiah(p.priceTo).replace("Rp", "")}/${p.unit}`;
  return `mulai ${rupiah(p.priceFrom)}/${p.unit}`;
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export function tanggal(d: Date | null | undefined) {
  if (!d) return "";
  return `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function waLink(number: string, text?: string) {
  const n = number.replace(/\D/g, "").replace(/^0/, "62");
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function telLink(number: string) {
  const n = number.replace(/\D/g, "").replace(/^0/, "62");
  return `tel:+${n}`;
}

export function imageUrl(key: string | null | undefined) {
  if (!key) return null;
  if (key.startsWith("/") || key.startsWith("http")) return key;
  return `/media/${key}`;
}
