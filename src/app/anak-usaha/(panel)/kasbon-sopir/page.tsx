import { KasbonBoard } from "@/components/ops/kasbon/KasbonBoard";
import { requirePerm } from "@/lib/auth";

export const metadata = { title: "Kasbon sopir" };

/** Kasbon sopir Ekspedisi Istana Block: PIC Kendaraan & keuangan. */
export default async function KasbonSopir() {
  await requirePerm("ekspedisi", "keuangan");
  return <KasbonBoard driver canEdit />;
}
