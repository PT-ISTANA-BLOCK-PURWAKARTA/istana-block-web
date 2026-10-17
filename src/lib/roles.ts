/** Peran pengguna, izin per aksi, dan aplikasi yang boleh dibuka. Dipakai di server dan klien (tanpa import server). */

export const ROLES = ["owner", "web", "keuangan", "operasional", "gudang", "sopir"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_SHORT: Record<Role, string> = { owner: "Pemilik", web: "Situs", keuangan: "Keuangan", operasional: "Operasional", gudang: "Gudang", sopir: "Sopir" };

/** Penjelasan singkat di halaman pengguna. */
export const ROLE_LABEL: Record<Role, string> = {
  owner: "Pemilik: semua aplikasi dan kelola pengguna",
  web: "Situs: produk, harga, artikel, halaman",
  keuangan: "Keuangan: faktur, penerimaan, pembelian, kas, laporan",
  operasional: "Operasional: pesanan (PO), jadwal kirim, surat jalan, pelanggan, armada, lacak truk",
  gudang: "Gudang: stok, hasil produksi, penyesuaian, muat & berangkatkan truk",
  sopir: "Sopir: tugas antar miliknya, konfirmasi terkirim dengan foto, bagikan lokasi",
};

/**
 * Peran yang boleh masuk dengan nomor HP + PIN (staf lapangan). Sesi PIN hanya membuka aplikasi
 * operasional; peran kantor (pemilik, situs, keuangan) selalu lewat email + password.
 */
export const FIELD_ROLES: readonly Role[] = ["operasional", "gudang", "sopir"];

/**
 * Izin per aksi.
 * - web: aplikasi situs /situs
 * - keuangan: seluruh aplikasi keuangan /akuntansi (termasuk nilai rupiah persediaan & faktur)
 * - lihat_ops: membuka /operasional (hanya baca bila tak punya izin lain)
 * - pesanan: membuat/mengubah pesanan & data pelanggan
 * - pengiriman: menjadwalkan surat jalan, armada, sopir, menandai terkirim/batal
 * - muat: menandai truk berangkat (barang keluar gudang)
 * - stok: hasil produksi, penyesuaian & saldo awal stok
 * - lacak: melihat posisi truk di peta
 * - antar: tugas antar milik sopir sendiri (tandai terkirim, bagikan lokasi)
 */
export const PERMS = ["web", "keuangan", "lihat_ops", "pesanan", "pengiriman", "muat", "stok", "lacak", "antar"] as const;
export type Perm = (typeof PERMS)[number];

const ROLE_PERMS: Record<Role, readonly Perm[]> = {
  owner: PERMS.filter((p) => p !== "antar"),
  web: ["web"],
  keuangan: ["keuangan", "lihat_ops"],
  operasional: ["lihat_ops", "pesanan", "pengiriman", "muat", "lacak"],
  gudang: ["lihat_ops", "stok", "muat"],
  sopir: ["antar"],
};

export function permsOf(roles: readonly Role[]): Set<Perm> {
  return new Set(roles.flatMap((r) => ROLE_PERMS[r] ?? []));
}

export function can(roles: readonly Role[], perm: Perm) {
  return roles.some((r) => ROLE_PERMS[r]?.includes(perm));
}

export type ModuleKey = "web" | "keuangan" | "operasional";
export type Via = "pw" | "pin";

export const MODULES: { key: ModuleKey; href: string; login: string; label: string; perms: Perm[]; pin: boolean }[] = [
  { key: "web", href: "/situs", login: "/situs/masuk", label: "Situs", perms: ["web"], pin: false },
  { key: "operasional", href: "/operasional", login: "/operasional/masuk", label: "Operasional", perms: ["lihat_ops", "antar"], pin: true },
  { key: "keuangan", href: "/akuntansi", login: "/akuntansi/masuk", label: "Keuangan", perms: ["keuangan"], pin: false },
];

export const moduleOf = (key: ModuleKey) => MODULES.find((m) => m.key === key)!;

/** Peran yang berlaku untuk sesi ini: sesi PIN hanya membawa peran lapangan. */
export function effectiveRoles(roles: readonly Role[], via: Via): Role[] {
  return via === "pin" ? roles.filter((r) => FIELD_ROLES.includes(r)) : [...roles];
}

export function normalizeRoles(v: unknown): Role[] {
  const arr = Array.isArray(v) ? v : [];
  const out = arr.filter((r): r is Role => (ROLES as readonly string[]).includes(String(r)));
  return out.length ? Array.from(new Set(out)) : [];
}

export function canOpen(roles: readonly Role[], module: ModuleKey) {
  return moduleOf(module).perms.some((p) => can(roles, p));
}

/** Halaman awal sebuah aplikasi untuk peran ini (sopir langsung ke daftar tugasnya). */
export function moduleHome(roles: readonly Role[], module: ModuleKey) {
  if (module === "operasional" && !can(roles, "lihat_ops") && can(roles, "antar")) return "/operasional/tugas";
  return moduleOf(module).href;
}

/** Tujuan bila halaman yang diminta bukan haknya: satu-satunya aplikasi yang boleh dibuka, atau halaman pilih aplikasi. */
export function homeFor(roles: readonly Role[]) {
  const mods = MODULES.filter((m) => canOpen(roles, m.key));
  if (mods.length === 1) return moduleHome(roles, mods[0].key);
  return mods.length ? "/internal" : null;
}

/** Path tujuan setelah login: hanya path internal di aplikasi yang boleh dibuka. */
export function safeNext(next: unknown, roles: readonly Role[]) {
  const n = String(next ?? "");
  if (!n.startsWith("/") || n.startsWith("//") || n.includes("\\")) return null;
  if (n === "/internal/pengguna" || n.startsWith("/internal/pengguna/")) return roles.includes("owner") ? n : null;
  const mod = MODULES.find((m) => n === m.href || n.startsWith(`${m.href}/`));
  if (!mod || n.startsWith(mod.login)) return null;
  if (!canOpen(roles, mod.key)) return null;
  // Sopir hanya punya halaman tugas.
  if (mod.key === "operasional" && !can(roles, "lihat_ops") && !n.startsWith("/operasional/tugas")) return null;
  return n;
}

/** Normalisasi nomor HP Indonesia ke bentuk 62xxxxxxxxx; null bila tidak masuk akal. */
export function normalizePhone(v: unknown): string | null {
  let d = String(v ?? "").replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("0")) d = `62${d.slice(1)}`;
  else if (d.startsWith("8")) d = `62${d}`;
  if (!/^628\d{7,12}$/.test(d)) return null;
  return d;
}

/** Tampilkan 62812… sebagai 0812-xxxx-xxxx. */
export function formatPhone(p: string | null | undefined) {
  if (!p) return "";
  const local = p.startsWith("62") ? `0${p.slice(2)}` : p;
  return local.replace(/^(\d{4})(\d{4})(\d+)$/, "$1-$2-$3");
}

/** PIN 6 digit yang terlalu mudah ditebak ditolak. */
export function weakPin(pin: string) {
  if (!/^\d{6}$/.test(pin)) return "PIN harus 6 angka.";
  if (/^(\d)\1{5}$/.test(pin)) return "PIN tidak boleh angka yang sama semua.";
  const asc = "0123456789012345";
  const desc = "9876543210987654";
  if (asc.includes(pin) || desc.includes(pin)) return "PIN tidak boleh angka berurutan.";
  if (/^(\d\d)\1\1$/.test(pin) || /^(\d{3})\1$/.test(pin)) return "PIN terlalu mudah ditebak; pakai kombinasi lain.";
  return null;
}
