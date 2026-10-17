/**
 * Perubahan dibanding periode lalu, ditulis dengan kata (naik/turun) — tidak hanya warna.
 * good: arah yang baik untuk angka ini ("up" untuk pendapatan & laba, "down" untuk biaya).
 */
export function changeText(now: number, prev: number, good: "up" | "down" = "up"): { text: string; tone?: "ok" | "warn" } {
  if (!prev && !now) return { text: "sama dengan periode lalu" };
  if (!prev) return { text: "periode lalu belum ada" };
  const pct = ((now - prev) / Math.abs(prev)) * 100;
  if (Math.abs(pct) < 0.5) return { text: "hampir sama dengan periode lalu" };
  const up = pct > 0;
  const n = Math.abs(pct) >= 1000 ? "lebih dari 10×" : `${Math.abs(pct).toLocaleString("id-ID", { maximumFractionDigits: Math.abs(pct) < 10 ? 1 : 0 })}%`;
  return { text: `${up ? "naik" : "turun"} ${n} dari periode lalu`, tone: up === (good === "up") ? "ok" : "warn" };
}
