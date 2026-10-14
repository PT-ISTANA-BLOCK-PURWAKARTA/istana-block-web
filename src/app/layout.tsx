import type { Metadata, Viewport } from "next";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "./globals.css";
import { getEnv } from "@/db";

export async function generateMetadata(): Promise<Metadata> {
  const env = await getEnv();
  return {
    metadataBase: new URL(env.SITE_URL || "http://localhost:3000"),
    title: { default: "Istana Block Purwakarta", template: "%s | Istana Block Purwakarta" },
    applicationName: "Istana Block Purwakarta",
    openGraph: { siteName: "Istana Block Purwakarta", locale: "id_ID", type: "website" },
  };
}

export const viewport: Viewport = { themeColor: "#0E2A6B" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
