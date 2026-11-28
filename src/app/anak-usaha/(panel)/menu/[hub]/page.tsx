// Menu ubin per bagian Anak Perusahaan (seperti layar menu Zahir 6 di Keuangan): Ekspedisi Istana Block, Proyek U-Ditch.
import { notFound } from "next/navigation";
import { ZahirTiles } from "@/components/erp/ZahirTiles";
import { requireAnak } from "@/lib/auth";
import { anakHub } from "@/lib/erp/anakMenu";

export async function generateMetadata({ params }: { params: Promise<{ hub: string }> }) {
  const h = anakHub((await params).hub);
  return { title: h ? h.title : "Menu" };
}

export default async function AnakHubPage({ params }: { params: Promise<{ hub: string }> }) {
  const hub = anakHub((await params).hub);
  if (!hub) notFound();
  await requireAnak(...hub.perms);
  return (
    <div className="zt-page">
      <header className="zt-head">
        <h1>{hub.title}</h1>
        <p>{hub.sub}</p>
      </header>
      <ZahirTiles tiles={hub.tiles} />
    </div>
  );
}
