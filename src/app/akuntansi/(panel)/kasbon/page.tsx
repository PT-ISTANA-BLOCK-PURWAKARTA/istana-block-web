import { KasbonBoard } from "@/components/ops/kasbon/KasbonBoard";
import { requireModule } from "@/lib/auth";

export const metadata = { title: "Kasbon karyawan" };

/** Kasbon karyawan pabrik (kecuali sopir). */
export default async function Kasbon() {
  await requireModule("keuangan");
  return <KasbonBoard driver={false} canEdit />;
}
