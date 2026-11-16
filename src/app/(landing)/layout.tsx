import { GoogleTagManager } from "@/components/GoogleTagManager";
import { JsonLd } from "@/components/JsonLd";
import { getEnv } from "@/db";
import { localBusiness } from "@/lib/jsonld";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function LandingLayout({ children }: { children: React.ReactNode }) {
  const [s, env] = await Promise.all([getSettings(), getEnv()]);
  return (
    <>
      <JsonLd data={localBusiness(s, env.SITE_URL)} />
      <main id="isi">{children}</main>
      <GoogleTagManager id={env.GTM_ID} siteUrl={env.SITE_URL} indexing={env.SEARCH_INDEXING} />
    </>
  );
}
