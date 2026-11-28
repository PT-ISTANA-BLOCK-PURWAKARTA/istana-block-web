import "@/app/panel.css";

export const dynamic = "force-dynamic";

// Sama dengan aplikasi lain (Keuangan, Operasional, Situs): gaya panel dimuat di akar aplikasi, supaya Anak Perusahaan
// tetap rapi bila dibuka langsung (bukan pindah dari aplikasi lain).
export default function AnakUsahaRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
