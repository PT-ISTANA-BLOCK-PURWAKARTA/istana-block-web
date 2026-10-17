/** Klasifikasi akun (aman dipakai di klien). */
import type { AccountGroup } from "@/db/erp";

export const GROUP_LABEL: Record<AccountGroup, string> = {
  kas_bank: "Kas & bank",
  piutang: "Piutang",
  persediaan: "Persediaan",
  aset_lancar_lain: "Aset lancar lainnya",
  aset_tetap: "Aset tetap",
  akum_penyusutan: "Akumulasi penyusutan",
  hutang_usaha: "Hutang usaha",
  hutang_lain: "Kewajiban lancar lainnya",
  modal: "Modal",
  pendapatan: "Pendapatan",
  hpp: "Harga pokok penjualan",
  beban: "Beban usaha",
  pendapatan_lain: "Pendapatan lain-lain",
  beban_lain: "Beban lain-lain",
};

const DEBIT_NORMAL = new Set<AccountGroup>(["kas_bank", "piutang", "persediaan", "aset_lancar_lain", "aset_tetap", "hpp", "beban", "beban_lain"]);

export function isDebitNormal(g: AccountGroup) {
  return DEBIT_NORMAL.has(g);
}

/** Saldo menurut saldo normal akun: positif = sesuai sisi normalnya. */
export function normalBalance(g: AccountGroup, debit: number, credit: number) {
  return isDebitNormal(g) ? debit - credit : credit - debit;
}

export type Section = "aset" | "kewajiban" | "modal" | "pendapatan" | "hpp" | "beban" | "lain";

export function sectionOf(g: AccountGroup): Section {
  switch (g) {
    case "kas_bank":
    case "piutang":
    case "persediaan":
    case "aset_lancar_lain":
    case "aset_tetap":
    case "akum_penyusutan":
      return "aset";
    case "hutang_usaha":
    case "hutang_lain":
      return "kewajiban";
    case "modal":
      return "modal";
    case "pendapatan":
      return "pendapatan";
    case "hpp":
      return "hpp";
    case "beban":
      return "beban";
    default:
      return "lain";
  }
}

export const GROUP_ORDER: AccountGroup[] = [
  "kas_bank",
  "piutang",
  "persediaan",
  "aset_lancar_lain",
  "aset_tetap",
  "akum_penyusutan",
  "hutang_usaha",
  "hutang_lain",
  "modal",
  "pendapatan",
  "hpp",
  "beban",
  "pendapatan_lain",
  "beban_lain",
];

export const ITEM_KIND_LABEL = { barang_jadi: "Barang jadi", bahan_baku: "Bahan baku", jasa: "Jasa", lainnya: "Lain-lain" } as const;
export const CONTACT_KIND_LABEL = { pelanggan: "Pelanggan", pemasok: "Pemasok", keduanya: "Pelanggan & pemasok" } as const;

/** Golongan akun yang boleh dipakai sebagai baris biaya di faktur pembelian. */
export const EXPENSE_GROUPS: string[] = ["beban", "beban_lain", "hpp", "aset_tetap", "aset_lancar_lain", "persediaan"];
