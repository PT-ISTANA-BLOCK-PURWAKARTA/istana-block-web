import { ROLE_SHORT, type Role } from "@/lib/roles";

/** Label modul log (awalan kode aksi sebelum titik). Modul lain tampil dengan namanya apa adanya. */
export const MODULE_LABELS: Record<string, string> = {
  auth: "Login & tanda tangan", pesanan: "Pesanan", pengiriman: "Pengiriman", armada: "Armada", sopir: "Sopir", produksi: "Produksi",
  barang_masuk: "Barang masuk", uji_pasir: "Uji lumpur", qc: "QC", iso: "Rekap ISO", kalender: "Kalender", piket: "Piket", backup: "Backup",
};
export const moduleLabel = (key: string) => MODULE_LABELS[key] ?? key.replace(/_/g, " ");

/** "owner,qc" → "Pemilik, QC". */
export const roleText = (role: string | null) => (role ? role.split(",").map((r) => ROLE_SHORT[r as Role] ?? r).join(", ") : "");

export const deviceLabel = (device: string | null) =>
  !device ? "-" : /Android/i.test(device) ? "HP Android" : /iPhone|iPad/i.test(device) ? "iPhone" : /Windows/i.test(device) ? "Komputer Windows" : /Mac/i.test(device) ? "Mac" : "Lainnya";
