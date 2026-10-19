import { GoogleTagManager } from "@/components/GoogleTagManager";
import { JsonLd } from "@/components/JsonLd";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getEnv } from "@/db";
import { localBusiness } from "@/lib/jsonld";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [s, env] = await Promise.all([getSettings(), getEnv()]);
  return (
    <>
      {/* Di layout, bukan beranda: halaman produk, artikel, dan area merujuk node #business lewat @id. */}
      <JsonLd data={localBusiness(s, env.SITE_URL)} />
      <SiteHeader s={s} />
      <main id="isi">{children}</main>
      <SiteFooter s={s} />
      <GoogleTagManager id={env.GTM_ID} siteUrl={env.SITE_URL} />
    </>
  );
}
