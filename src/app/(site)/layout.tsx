import { GoogleTagManager } from "@/components/GoogleTagManager";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getEnv } from "@/db";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [s, env] = await Promise.all([getSettings(), getEnv()]);
  return (
    <>
      <SiteHeader s={s} />
      <main id="isi">{children}</main>
      <SiteFooter s={s} />
      <GoogleTagManager id={env.GTM_ID} siteUrl={env.SITE_URL} />
    </>
  );
}
