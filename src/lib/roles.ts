/** Peran pengguna, izin per aksi, dan modul yang boleh dibuka. Dipakai di server dan klien (tanpa import server). */

export const ROLES = ["owner", "web", "keuangan", "operasional", "gudang"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_SHORT: Record<Role, string> = { owner: "Pemilik", web: "Situs", keuangan: "Keuangan", operasional: "Operasional", gudang: "Gudang" };

/** Penjelasan singkat di halaman pengguna. */
export const ROLE_LABEL: Record<Role, string> = {
  owner: "Pemilik: semua modul dan kelola pengguna",
  web: "Situs: produk, harga, artikel, halaman di /admin",
  keuangan: "Keuangan: faktur, penerimaan, pembelian, kas, laporan",
  operasional: "Operasional: pesanan (PO), jadwal kirim, surat jalan, pelanggan, armada",
  gudang: "Gudang: stok, hasil produksi, penyesuaian, muat & berangkatkan truk",
};

/**
 * Izin per aksi.
 * - web: panel situs /admin
 * - keuangan: seluruh modul keuangan (termasuk melihat nilai rupiah persediaan & faktur)
 * - lihat_ops: membuka /operasional (hanya baca bila tak punya izin lain)
 * - pesanan: membuat/mengubah pesanan & data pelanggan
 * - pengiriman: menjadwalkan surat jalan, armada, sopir, menandai terkirim/batal
 * - muat: menandai truk berangkat (barang keluar gudang)
 * - stok: hasil produksi, penyesuaian & saldo awal stok
 */
export const PERMS = ["web", "keuangan", "lihat_ops", "pesanan", "pengiriman", "muat", "stok"] as const;
export type Perm = (typeof PERMS)[number];

const ROLE_PERMS: Record<Role, readonly Perm[]> = {
  owner: PERMS,
  web: ["web"],
  keuangan: ["keuangan", "lihat_ops"],
  operasional: ["lihat_ops", "pesanan", "pengiriman", "muat"],
  gudang: ["lihat_ops", "stok", "muat"],
};

export function permsOf(roles: readonly Role[]): Set<Perm> {
  return new Set(roles.flatMap((r) => ROLE_PERMS[r] ?? []));
}

export function can(roles: readonly Role[], perm: Perm) {
  return roles.some((r) => ROLE_PERMS[r]?.includes(perm));
}

export type ModuleKey = "web" | "keuangan" | "operasional";

export const MODULES: { key: ModuleKey; href: string; label: string; perm: Perm }[] = [
  { key: "web", href: "/admin", label: "Situs", perm: "web" },
  { key: "keuangan", href: "/keuangan", label: "Keuangan", perm: "keuangan" },
  { key: "operasional", href: "/operasional", label: "Operasional", perm: "lihat_ops" },
];

export function normalizeRoles(v: unknown): Role[] {
  const arr = Array.isArray(v) ? v : [];
  const out = arr.filter((r): r is Role => (ROLES as readonly string[]).includes(String(r)));
  return out.length ? Array.from(new Set(out)) : [];
}

export function canOpen(roles: readonly Role[], module: ModuleKey) {
  const m = MODULES.find((x) => x.key === module);
  return !!m && can(roles, m.perm);
}

/**
 * Halaman awal setelah login: modul "utama" peran itu. Staf keuangan juga boleh melihat operasional,
 * tapi halaman awalnya tetap keuangan.
 */
export function homeFor(roles: readonly Role[]) {
  if (roles.includes("owner")) return "/admin";
  if (roles.includes("keuangan")) return "/keuangan";
  if (roles.includes("operasional") || roles.includes("gudang")) return "/operasional";
  if (roles.includes("web")) return "/admin";
  return null;
}

/** Path tujuan setelah login: hanya path internal di modul yang boleh dibuka. */
export function safeNext(next: unknown, roles: readonly Role[]) {
  const n = String(next ?? "");
  if (!n.startsWith("/") || n.startsWith("//") || n.includes("\\")) return null;
  const mod = MODULES.find((m) => n === m.href || n.startsWith(`${m.href}/`));
  if (!mod || n.startsWith("/admin/login")) return null;
  return canOpen(roles, mod.key) ? n : null;
}
