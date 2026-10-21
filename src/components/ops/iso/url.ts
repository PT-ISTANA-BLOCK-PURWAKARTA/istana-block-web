import type { DayRange } from "@/lib/ops/shared/isoRecap";
import type { IsoCode } from "@/lib/ops/shared/isoForms";

export const ISO_BASE = "/operasional/rekap-iso";
export type IsoTab = "ringkasan" | "sasaran" | "form";

/** Keadaan halaman yang tersimpan di URL: ?dari=&sampai=&tab=&form=&offset= */
export type IsoView = { range: DayRange; tab: IsoTab; code: IsoCode; offset: number };

/** Alamat halaman Rekap ISO untuk keadaan tertentu; `extra` menambah parameter aksi (aksi, id, key, isi, bulan, ...). */
export function isoUrl(view: Partial<IsoView> & { range: DayRange }, extra: Record<string, string | undefined> = {}) {
  const q = new URLSearchParams({ dari: view.range.from, sampai: view.range.to, tab: view.tab ?? "ringkasan" });
  if (view.tab === "form" && view.code) q.set("form", view.code);
  if (view.tab === "form" && view.offset) q.set("offset", String(view.offset));
  for (const [key, value] of Object.entries(extra)) if (value) q.set(key, value);
  return `${ISO_BASE}?${q}`;
}
