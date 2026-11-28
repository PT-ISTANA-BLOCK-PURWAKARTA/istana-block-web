import type { Metadata } from "next";
import { PanelShell, type ShellItem } from "@/components/panel/PanelShell";
import { requireModule } from "@/lib/auth";
import type { Perm } from "@/lib/roles";

export const metadata: Metadata = { title: { default: "Anak Perusahaan", template: "%s · Anak Perusahaan Istana Block" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Anak perusahaan, terpisah dari Operasional Pabrik & keuangan IB: Ekspedisi Istana Block (PIC Kendaraan: Cepi) dan
// Proyek U-Ditch (CV. Istana Bangun Nusantara, PIC: Lina). Menu atas gaya Zahir Online seperti Keuangan.
const EKSPEDISI: Perm[] = ["ekspedisi", "keuangan"];
const UDITCH: Perm[] = ["uditch", "keuangan"];
const ITEMS: ShellItem[] = [
  { href: "/anak-usaha", label: "Ringkasan", icon: "home" },
  { href: "/anak-usaha/menu/ekspedisi", label: "Semua menu Ekspedisi", group: "Ekspedisi", icon: "menu", perm: EKSPEDISI },
  { href: "/anak-usaha/biaya-armada", label: "Biaya Armada", group: "Ekspedisi", icon: "car", perm: EKSPEDISI },
  { href: "/anak-usaha/invoice-angkutan", label: "Invoice Angkutan", group: "Ekspedisi", icon: "invoice", perm: EKSPEDISI },
  { href: "/anak-usaha/dana-cepi", label: "Dana Cepi", group: "Ekspedisi", icon: "pay", perm: EKSPEDISI },
  { href: "/anak-usaha/piutang-cepi", label: "Piutang Cepi", group: "Ekspedisi", icon: "ledger", perm: EKSPEDISI },
  { href: "/anak-usaha/kasbon-sopir", label: "Kasbon Sopir", group: "Ekspedisi", icon: "cash", perm: EKSPEDISI },
  { href: "/anak-usaha/menu/uditch", label: "Semua menu U-Ditch", group: "Proyek U-Ditch", icon: "menu", perm: UDITCH },
  { href: "/anak-usaha/uditch", label: "Operational U-Ditch", group: "Proyek U-Ditch", icon: "book", perm: UDITCH },
  { href: "/anak-usaha/invoice-uditch", label: "Invoice U-Ditch", group: "Proyek U-Ditch", icon: "invoice", perm: UDITCH },
  { href: "/anak-usaha/surat-jalan-uditch", label: "Surat Jalan U-Ditch", group: "Proyek U-Ditch", icon: "truckGo", perm: UDITCH },
  { href: "/anak-usaha/surat-jalan-ibn", label: "Surat Jalan IBN", group: "Proyek U-Ditch", icon: "truck", perm: UDITCH },
];

export default async function AnakUsahaLayout({ children }: { children: React.ReactNode }) {
  const user = await requireModule("anak");
  return (
    <PanelShell module="anak" tag="Anak Perusahaan" items={ITEMS} user={user} layout="top">
      {children}
    </PanelShell>
  );
}
