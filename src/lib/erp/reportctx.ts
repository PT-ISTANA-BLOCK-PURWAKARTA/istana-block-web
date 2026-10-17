import "server-only";
import { getDb } from "@/db";
import { requireModule } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getFinSettings, loadAccounts } from "./server";

/** Yang dibutuhkan setiap halaman laporan: pengguna, database, bagan akun, dan data kop. */
export async function reportContext() {
  const me = await requireModule("keuangan");
  const db = await getDb();
  const [acc, site, fin] = await Promise.all([loadAccounts(db), getSettings(), getFinSettings(db)]);
  return { me, db, acc, site, npwp: fin.npwp };
}

/** Penjelasan ramah untuk akun lawan di laporan arus kas. */
export const CASH_LABEL: Record<string, string> = {
  piutang: "Pelanggan membayar faktur",
  uang_muka_pelanggan: "Uang muka (DP) pelanggan",
  penjualan: "Penjualan tunai",
  pendapatan_jasa: "Jasa pemasangan tunai",
  pendapatan_ongkir: "Ongkos kirim tunai",
  hutang: "Membayar faktur pemasok",
  uang_muka_pembelian: "Uang muka ke pemasok",
  ppn_keluaran: "Setor PPN",
  ppn_masukan: "PPN masukan",
  modal: "Setoran modal pemilik",
  persediaan_bahan: "Beli bahan baku tunai",
  upah_produksi: "Upah produksi",
};
