import { PAVING_CATALOG, type ProductId } from "../catalog";
import { SISA_POTONG_PERSEN, type BentukLahan, type KelasBeban } from "./konstanta-sementara";
import { ceilAman, cekNonNegatif } from "./util";

export interface AreaInput {
  id: string;
  label?: string;
  produkId: ProductId;
  /** Luas kotor (m²), mis. dari metrics.siteAreaM2 hasil engine. */
  luasKotorM2: number;
  /** Luas tiap lubang (m²), sama dengan holes di engine. */
  lubangM2?: number[];
  tebalCm?: number;
  kelas?: KelasBeban;
  bentuk?: BentukLahan;
  kelilingM?: number;
  /** Jumlah pcs hasil layout engine; bila ada, dipakai sebagai dasar menggantikan luas x pcs/m². */
  pcsLayout?: number;
  /** Timpa sisa potong (%). Isi 0 bila pcsLayout sudah memuat cadangan (total dari hitungan utama). */
  sisaPersen?: number;
}

export interface HasilArea {
  id: string;
  label: string;
  produkId: ProductId;
  luasKotorM2: number;
  luasLubangM2: number;
  luasBersihM2: number;
  pcsDasar: number;
  sisaPersen: number;
  pcsBeli: number;
}

export interface HasilMultiArea {
  rows: HasilArea[];
  totalLuasBersihM2: number;
  totalPcsBeli: number;
  perProduk: Partial<Record<ProductId, number>>;
}

/** Luas kotor dikurangi semua lubang. Lubang melebihi luas -> RangeError. */
export function luasBersih(luasKotorM2: number, lubangM2: number[] = []): number {
  cekNonNegatif("luasKotorM2", luasKotorM2);
  const total = lubangM2.reduce((a, b) => a + cekNonNegatif("lubangM2", b), 0);
  if (total > luasKotorM2 + 1e-9) {
    throw new RangeError(`Luas lubang (${total} m²) melebihi luas area (${luasKotorM2} m²)`);
  }
  return Math.max(0, luasKotorM2 - total);
}

/** Faktor sisa potong/pecah (%) menurut bentuk lahan. */
export function sisaPotongPersen(bentuk: BentukLahan = "sederhana"): number {
  return SISA_POTONG_PERSEN[bentuk].nilai;
}

export function hitungArea(a: AreaInput): HasilArea {
  const lubang = a.lubangM2 ?? [];
  const bersih = luasBersih(a.luasKotorM2, lubang);
  const spec = PAVING_CATALOG[a.produkId];
  const pcsDasar =
    a.pcsLayout !== undefined
      ? ceilAman(cekNonNegatif("pcsLayout", a.pcsLayout))
      : ceilAman(bersih * spec.labelPcsPerM2);
  const sisaPersen = a.sisaPersen ?? sisaPotongPersen(a.bentuk);
  return {
    id: a.id,
    label: a.label ?? a.id,
    produkId: a.produkId,
    luasKotorM2: a.luasKotorM2,
    luasLubangM2: a.luasKotorM2 - bersih,
    luasBersihM2: bersih,
    pcsDasar,
    sisaPersen,
    pcsBeli: pcsDasar + ceilAman(pcsDasar * (sisaPersen / 100)),
  };
}

/** Jumlahkan beberapa area (produk boleh berbeda). Daftar kosong -> semua nol. */
export function hitungMultiArea(areas: AreaInput[]): HasilMultiArea {
  const rows = areas.map(hitungArea);
  const perProduk: Partial<Record<ProductId, number>> = {};
  for (const r of rows) perProduk[r.produkId] = (perProduk[r.produkId] ?? 0) + r.pcsBeli;
  return {
    rows,
    totalLuasBersihM2: rows.reduce((a, r) => a + r.luasBersihM2, 0),
    totalPcsBeli: rows.reduce((a, r) => a + r.pcsBeli, 0),
    perProduk,
  };
}
