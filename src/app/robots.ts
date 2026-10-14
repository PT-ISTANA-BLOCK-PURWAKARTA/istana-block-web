import type { MetadataRoute } from "next";
import { getEnv } from "@/db";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const env = await getEnv();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api"] }],
    sitemap: `${env.SITE_URL}/sitemap.xml`,
  };
}
