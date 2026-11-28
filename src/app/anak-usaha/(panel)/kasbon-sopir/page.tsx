import { KasbonBoard } from "@/components/ops/kasbon/KasbonBoard";
import { ZahirPage } from "@/components/erp/ZahirPage";
import { requireAnak } from "@/lib/auth";

export const metadata = { title: "Kasbon sopir" };

/** Kasbon sopir Ekspedisi Istana Block: PIC Kendaraan & keuangan. */
export default async function KasbonSopir() {
  await requireAnak("ekspedisi", "keuangan");
  return (
    <ZahirPage title="Kasbon Sopir" hub="/anak-usaha/menu/ekspedisi">
      <KasbonBoard driver canEdit />
    </ZahirPage>
  );
}
