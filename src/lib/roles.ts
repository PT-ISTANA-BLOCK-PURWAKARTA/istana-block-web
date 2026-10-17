/** Peran pengguna dan modul yang boleh dibuka. Dipakai di server dan klien (tanpa import server). */

export const ROLES = ["owner", "web", "keuangan", "operasional"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Pemilik (semua modul & kelola pengguna)",
  web: "Admin situs (/admin)",
  keuangan: "Keuangan (/keuangan)",
  operasional: "Operasional (/operasional)",
};

export const ROLE_SHORT: Record<Role, string> = { owner: "Pemilik", web: "Situs", keuangan: "Keuangan", operasional: "Operasional" };

export type ModuleKey = "web" | "keuangan" | "operasional";

export const MODULES: { key: ModuleKey; href: string; label: string }[] = [
  { key: "web", href: "/admin", label: "Situs" },
  { key: "keuangan", href: "/keuangan", label: "Keuangan" },
  { key: "operasional", href: "/operasional", label: "Operasional" },
];

export function normalizeRoles(v: unknown): Role[] {
  const arr = Array.isArray(v) ? v : [];
  const out = arr.filter((r): r is Role => (ROLES as readonly string[]).includes(String(r)));
  return out.length ? Array.from(new Set(out)) : [];
}

export function canOpen(roles: readonly Role[], module: ModuleKey) {
  return roles.includes("owner") || roles.includes(module);
}

/** Modul pertama yang boleh dibuka; dipakai setelah login. */
export function homeFor(roles: readonly Role[]) {
  return MODULES.find((m) => canOpen(roles, m.key))?.href ?? null;
}

/** Path tujuan setelah login: hanya path internal di modul yang boleh dibuka. */
export function safeNext(next: unknown, roles: readonly Role[]) {
  const n = String(next ?? "");
  if (!n.startsWith("/") || n.startsWith("//") || n.includes("\\")) return null;
  const mod = MODULES.find((m) => n === m.href || n.startsWith(`${m.href}/`));
  if (!mod || n.startsWith("/admin/login")) return null;
  return canOpen(roles, mod.key) ? n : null;
}
