// Ringkasan Anak Perusahaan gaya Zahir: menu ubin tiap bagian yang boleh dibuka akun ini
// (PIC Kendaraan hanya Ekspedisi, PIC U-Ditch hanya Proyek U-Ditch, Keuangan & pemilik keduanya).
import { ZahirTiles } from "@/components/erp/ZahirTiles";
import { requireModule } from "@/lib/auth";
import { ANAK_HUBS } from "@/lib/erp/anakMenu";
import { can } from "@/lib/roles";

export const metadata = { title: "Ringkasan" };

export default async function AnakUsaha() {
  const me = await requireModule("anak");
  const hubs = ANAK_HUBS.filter((h) => h.perms.some((p) => can(me.roles, p)));
  return (
    <div className="zt-page">
      {hubs.map((hub) => (
        <section key={hub.slug} style={{ marginBottom: 28 }}>
          <header className="zt-head">
            <h1>{hub.title}</h1>
            <p>{hub.sub}</p>
          </header>
          <ZahirTiles tiles={hub.tiles} />
        </section>
      ))}
    </div>
  );
}
