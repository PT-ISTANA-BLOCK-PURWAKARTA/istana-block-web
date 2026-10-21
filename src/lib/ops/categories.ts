/** Kategori produksi lapangan yang boleh diisi sebuah akun (aman dipakai di klien dan server). */
import type { ProductionCategory } from "@/db/erp";
import type { Role } from "@/lib/roles";

/** mandor hanya precast, qc hanya paving, pemilik & operasional keduanya. */
export function productionCategories(roles: readonly Role[]): ProductionCategory[] {
  if (roles.includes("owner") || roles.includes("operasional")) return ["precast", "paving"];
  const out: ProductionCategory[] = [];
  if (roles.includes("mandor")) out.push("precast");
  if (roles.includes("qc")) out.push("paving");
  return out;
}

/**
 * Kategori produksi sebuah barang jadi: paving bila produk websitenya berkategori Paving, kodenya berawalan PVG,
 * atau namanya memuat "paving"; selain itu precast. Grass block selalu precast (PRECAST_PRODUCTS sumber).
 */
export function itemProductionCategory(item: { code: string; name: string }, webCategory?: string | null): ProductionCategory {
  if (/grass ?block/i.test(item.name)) return "precast";
  return webCategory === "Paving" || /^pvg/i.test(item.code) || /paving/i.test(item.name) ? "paving" : "precast";
}
