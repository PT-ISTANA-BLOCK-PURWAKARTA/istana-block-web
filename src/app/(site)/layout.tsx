import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <>
      <SiteHeader s={s} />
      <main id="isi">{children}</main>
      <SiteFooter s={s} />
    </>
  );
}
