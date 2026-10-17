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
    openGraph: { siteName: "Istana Block Purwakarta", locale: "id_ID", type: "website" },
    ...(env.DEMO_MODE === "1" ? { robots: { index: false, follow: false } } : {}),
  };
}

export const viewport: Viewport = { themeColor: "#0E2A6B" };

// Semua halaman membaca binding Cloudflare (env/D1) saat diminta, jadi tidak ada yang dirender saat build.
// Tanpa ini Next merender /_not-found ketika build dan menyalakan runtime Workers lokal, yang bisa
// crash di Windows ("access violation").
export const dynamic = "force-dynamic";

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
