import type { Metadata } from "next";
import { PanelShell, type ShellItem } from "@/components/panel/PanelShell";
import { requireModule } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Anak Perusahaan", template: "%s · Anak Perusahaan Istana Block" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Anak perusahaan, terpisah dari Operasional Pabrik: Ekspedisi Istana Block (PIC Kendaraan: Cepi) dan proyek U-Ditch.
const ITEMS: ShellItem[] = [
  { href: "/anak-usaha", label: "Ringkasan", icon: "home" },
  { href: "/anak-usaha/biaya-armada", label: "Biaya armada", group: "Ekspedisi Istana Block", icon: "car", perm: ["ekspedisi", "keuangan"] },
  { href: "/anak-usaha/dana-cepi", label: "Dana Cepi", group: "Ekspedisi Istana Block", icon: "pay", perm: ["ekspedisi", "keuangan"] },
  { href: "/anak-usaha/piutang-cepi", label: "Piutang Cepi", group: "Ekspedisi Istana Block", icon: "ledger", perm: ["ekspedisi", "keuangan"] },
  { href: "/anak-usaha/kasbon-sopir", label: "Kasbon sopir", group: "Ekspedisi Istana Block", icon: "cash", perm: ["ekspedisi", "keuangan"] },
  { href: "/anak-usaha/uditch", label: "Operational U-Ditch", group: "Proyek U-Ditch", icon: "invoice", perm: ["keuangan"] },
  { href: "/anak-usaha/surat-jalan-ibn", label: "Surat Jalan IBN", group: "Proyek U-Ditch", icon: "truck", perm: ["keuangan"] },
];

export default async function AnakUsahaLayout({ children }: { children: React.ReactNode }) {
  const user = await requireModule("anak");
  return (
    <PanelShell module="anak" tag="Anak Perusahaan" items={ITEMS} user={user}>
      {children}
    </PanelShell>
  );
}
