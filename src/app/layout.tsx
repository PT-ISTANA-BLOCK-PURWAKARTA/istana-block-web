import type { Metadata, Viewport } from "next";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "./globals.css";
import "./panel.css";
import "./ui.css";
import { getEnv } from "@/db";

export async function generateMetadata(): Promise<Metadata> {
  const env = await getEnv();
  return {
    metadataBase: new URL(env.SITE_URL || "http://localhost:3000"),
    title: { default: "Istana Block Purwakarta", template: "%s | Istana Block Purwakarta" },
    applicationName: "Istana Block Purwakarta",
    // Gambar cadangan untuk halaman tanpa openGraph sendiri (/produk, /kontak, /area-pengiriman, /paket-proyek,
    // /artikel). Halaman yang mendefinisikan openGraph menggantikan seluruh objek ini, jadi tidak tertimpa.
    openGraph: {
      siteName: "Istana Block Purwakarta",
      locale: "id_ID",
      type: "website",
      images: [
        {
          url: "/og-default.jpg",
          width: 1200,
          height: 630,
          alt: "Mesin cetak paving di pabrik Istana Block Purwakarta dengan paving yang baru dicetak",
        },
      ],
    },
    // Gambar twitter:image diambil Next dari openGraph.images halaman yang sama.
    twitter: { card: "summary_large_image" },
    // Demo tetap noindex. Situs publik mengizinkan pratinjau gambar besar dan cuplikan tanpa batas di hasil
    // pencarian. Layout panel dan halaman 404/cetak menimpa seluruh objek robots dengan index:false sendiri.
    robots:
      env.DEMO_MODE === "1"
        ? { index: false, follow: false }
        : { index: true, follow: true, googleBot: { "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  };
}

export const viewport: Viewport = { themeColor: "#0E2A6B" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const env = await getEnv();
  return (
    <html lang="id">
      <body>
        {env.DEMO_MODE === "1" && (
          <div className="demo-strip no-print" role="note">
            <b>Versi demo</b> · semua pesanan, faktur, dan laporan di sini adalah data contoh fiktif. Situs resmi: istanablockpurwakarta.com
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
