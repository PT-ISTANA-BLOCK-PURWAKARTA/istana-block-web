/** Jenis paving: model → ukuran → warna. Nama baku dipakai di hasil produksi & stok supaya rekap tidak terpecah. */
export const PAVING_MODELS = [
  { key: "bata", label: "Bata", sizes: ["6 cm", "8 cm"] },
  { key: "ubin", label: "Ubin", sizes: ["21×21", "30×30"] },
  { key: "hexagon", label: "Hexagon", sizes: ["Utuh", "Setengah (trapesium)"] },
] as const;

export const PAVING_COLORS = ["Abu natural", "Merah", "Hitam"] as const;

export type PavingModelKey = (typeof PAVING_MODELS)[number]["key"];
export type PavingColor = (typeof PAVING_COLORS)[number];
export type PavingChoice = { model?: PavingModelKey; size?: string; color?: PavingColor };

export const pavingModel = (key?: string) => PAVING_MODELS.find((model) => model.key === key);

/** "Bata 8 cm · Abu natural" — kosong bila belum lengkap. */
export function pavingName(choice: PavingChoice): string {
  const model = pavingModel(choice.model);
  if (!model || !choice.size || !choice.color) return "";
  return `${model.label} ${choice.size} · ${choice.color}`;
}

/** Baca nama paving (baku maupun tulisan lama, mis. "paving bata 8cm k350") menjadi pilihan model/ukuran/warna. */
export function parsePaving(text: string | null | undefined): PavingChoice {
  const t = (text ?? "").toLowerCase();
  if (!t.trim() || /gras/.test(t)) return {};
  const model: PavingModelKey | undefined = /ubin|fullpave/.test(t)
    ? "ubin"
    : /hexa|segi ?enam/.test(t)
      ? "hexagon"
      : /bata|truepave|paving/.test(t)
        ? "bata"
        : undefined;
  let size: string | undefined;
  if (model === "bata") size = /8\s*cm/.test(t) ? "8 cm" : /6\s*cm/.test(t) ? "6 cm" : undefined;
  if (model === "ubin") size = /30/.test(t) ? "30×30" : /21/.test(t) ? "21×21" : undefined;
  if (model === "hexagon") size = /setengah|belah|trapes/.test(t) ? "Setengah (trapesium)" : "Utuh";
  const color: PavingColor | undefined = /merah/.test(t)
    ? "Merah"
    : /hitam/.test(t)
      ? "Hitam"
      : /abu|natural/.test(t)
        ? "Abu natural"
        : undefined;
  return { model, size, color };
}

/** Hexagon utuh → nama baku belahan setengah (trapesium) dengan warna yang sama; null bila bukan hexagon utuh. */
export function hexagonHalfName(name: string | null | undefined): string | null {
  const choice = parsePaving(name);
  return choice.model === "hexagon" && choice.size === "Utuh" && choice.color
    ? pavingName({ model: "hexagon", size: "Setengah (trapesium)", color: choice.color })
    : null;
}

export const isHalfPiece = (name: string | null | undefined) => /setengah|trapes/i.test(name ?? "");

/** Paving berwarna (merah / hitam). */
export const isColoredPaving = (product: string | null | undefined) => /merah|hitam/i.test(product ?? "");

/** Lapisan kepalaan paving berwarna memakai semen putih: nama bahan "Semen" ↔ "Semen putih" mengikuti warna. */
export function cementForColor<T extends { name: string }>(
  materials: T[],
  layer: string,
  product: string | null | undefined,
): T[] {
  if (layer !== "kepalaan") return materials;
  const colored = isColoredPaving(product);
  return materials.map((m) =>
    colored && m.name.trim().toLowerCase() === "semen"
      ? { ...m, name: "Semen putih" }
      : !colored && m.name.trim().toLowerCase() === "semen putih"
        ? { ...m, name: "Semen" }
        : m,
  );
}
