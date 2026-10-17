import type { MetadataRoute } from "next";
import { getEnv } from "@/db";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const env = await getEnv();
  // Worker demo berisi salinan situs + data contoh: jangan diindeks sama sekali.
  if (env.DEMO_MODE === "1") return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/internal", "/situs", "/akuntansi", "/operasional", "/admin", "/keuangan", "/api"] }],
    sitemap: `${env.SITE_URL}/sitemap.xml`,
  };
}
