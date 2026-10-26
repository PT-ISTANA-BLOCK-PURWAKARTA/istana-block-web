import { GoogleTagManager } from "@/components/GoogleTagManager";
import { JsonLd } from "@/components/JsonLd";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getEnv } from "@/db";
import { localBusiness } from "@/lib/jsonld";
import { getSettings } from "@/lib/settings";

// Sengaja tetap force-dynamic: open-next.config.ts memakai incremental cache kosong (tanpa binding R2/KV),
// jadi tanpa ini Next membekukan data D1 saat build dan isi panel /situs tidak pernah muncul. Cache
// halaman publik ada di worker.ts (5 menit + stale-while-revalidate); data D1 di-memo di src/lib/queries.ts.
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
