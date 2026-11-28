// Menu ubin Anak Perusahaan (gaya Zahir, sama dengan menu Keuangan): Ekspedisi Istana Block dan Proyek U-Ditch.
// Tiap bagian hanya untuk pemegang izinnya: Ekspedisi = PIC Kendaraan (Cepi) + Keuangan, U-Ditch = PIC U-Ditch (Lina) + Keuangan.
import type { Hub } from "@/lib/erp/zahirMenu";
import type { Perm } from "@/lib/roles";

export type AnakHub = Hub & { perms: Perm[] };

export const ANAK_HUBS: AnakHub[] = [
  {
    slug: "ekspedisi",
    title: "Ekspedisi Istana Block",
    sub: "PIC Kendaraan: biaya armada per mobil, invoice angkutan, Dana & Piutang Cepi, kasbon sopir.",
    perms: ["ekspedisi", "keuangan"],
    tiles: [
      { label: "Biaya Armada", href: "/anak-usaha/biaya-armada", icon: "car", color: "blue", w: 2 },
      { label: "Invoice Angkutan", href: "/anak-usaha/invoice-angkutan", icon: "invoice", color: "red", h: 2 },
      { label: "Invoice Angkutan Baru", href: "/anak-usaha/invoice-angkutan/baru", icon: "pencil", color: "navy" },
      { label: "Dana Cepi", href: "/anak-usaha/dana-cepi", icon: "pay", color: "green" },
      { label: "Piutang Cepi", href: "/anak-usaha/piutang-cepi", icon: "ledger", color: "purple" },
      { label: "Kasbon Sopir", href: "/anak-usaha/kasbon-sopir", icon: "cash", color: "orange" },
    ],
  },
  {
    slug: "uditch",
    title: "Proyek U-Ditch",
    sub: "CV. Istana Bangun Nusantara — terpisah dari keuangan IB. Pembayaran Invoice U-Ditch masuk saldo Lina di Operational U-Ditch.",
    perms: ["uditch", "keuangan"],
    tiles: [
      { label: "Operational U-Ditch", href: "/anak-usaha/uditch", icon: "book", color: "blue", w: 2 },
      { label: "Invoice U-Ditch", href: "/anak-usaha/invoice-uditch", icon: "invoice", color: "crimson", h: 2 },
      { label: "Invoice U-Ditch Baru", href: "/anak-usaha/invoice-uditch/baru", icon: "pencil", color: "navy" },
      { label: "Surat Jalan IBN", href: "/anak-usaha/surat-jalan-ibn", icon: "truck", color: "green" },
      { label: "Surat Jalan IBN Baru", href: "/anak-usaha/surat-jalan-ibn?baru=1", icon: "truckGo", color: "lime" },
    ],
  },
];

export const anakHub = (slug: string) => ANAK_HUBS.find((h) => h.slug === slug);
