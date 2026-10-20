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
