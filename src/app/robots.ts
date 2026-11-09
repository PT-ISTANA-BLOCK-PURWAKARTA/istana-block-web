import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getEnv } from "@/db";
import { isIndexable } from "@/lib/host";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const env = await getEnv();
  // Worker demo berisi salinan situs + data contoh: jangan diindeks sama sekali.
  if (env.DEMO_MODE === "1") return { rules: [{ userAgent: "*", disallow: "/" }] };
  // Host selain SITE_URL (staging *.workers.dev, URL preview): tutup total dan jangan promosikan
  // sitemap-nya, supaya salinan situs tidak bersaing dengan domain resmi. Cache worker.ts
  // memakai host di kunci URL, jadi jawaban ini tidak bocor ke domain resmi.
  // Saklar SEARCH_INDEXING bukan "on" (soft launch): semua host tertutup, termasuk SITE_URL.
  if (!isIndexable((await headers()).get("host"), env.SITE_URL, env.SEARCH_INDEXING)) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/internal", "/situs", "/akuntansi", "/operasional", "/admin", "/keuangan", "/api"] }],
    sitemap: `${env.SITE_URL}/sitemap.xml`,
  };
}
