// Halaman menu ubin per modul (seperti layar menu Zahir 6): Data-Data, Buku Besar, Penjualan, Pembelian, Kas & Bank, Persediaan.
import { notFound } from "next/navigation";
import { ZahirTiles } from "@/components/erp/ZahirTiles";
import { requireModule } from "@/lib/auth";
import { hubBySlug } from "@/lib/erp/zahirMenu";

export async function generateMetadata({ params }: { params: Promise<{ hub: string }> }) {
  const h = hubBySlug((await params).hub);
  return { title: h ? h.title : "Menu" };
}

export default async function HubPage({ params }: { params: Promise<{ hub: string }> }) {
  await requireModule("keuangan");
  const hub = hubBySlug((await params).hub);
  if (!hub) notFound();
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
