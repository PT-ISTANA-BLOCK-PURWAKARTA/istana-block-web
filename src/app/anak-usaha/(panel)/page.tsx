import Link from "next/link";
import { PageHead } from "@/components/erp/ui";
import { requireModule } from "@/lib/auth";
import { can } from "@/lib/roles";

export const metadata = { title: "Ringkasan" };

export default async function AnakUsaha() {
  const me = await requireModule("anak");
  const fleet = can(me.roles, "ekspedisi") || can(me.roles, "keuangan");
  const uditch = can(me.roles, "keuangan");
  return (
    <>
      <PageHead title="Anak Perusahaan" sub="Pembukuan anak perusahaan, terpisah dari Operasional Pabrik." />
      <div className="qc-tests" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
        {fleet && (
          <article className="admin-card">
            <h3 style={{ marginTop: 0 }}>Ekspedisi Istana Block</h3>
            <p className="muted small">PIC Kendaraan: biaya armada per mobil, Dana Cepi, Piutang Cepi, dan kasbon sopir.</p>
            <div className="qc-row-actions">
              <Link href="/anak-usaha/biaya-armada" className="btn btn-primary btn-sm">Biaya armada</Link>
              <Link href="/anak-usaha/dana-cepi" className="btn btn-ghost btn-sm">Dana Cepi</Link>
              <Link href="/anak-usaha/piutang-cepi" className="btn btn-ghost btn-sm">Piutang Cepi</Link>
              <Link href="/anak-usaha/kasbon-sopir" className="btn btn-ghost btn-sm">Kasbon sopir</Link>
            </div>
          </article>
        )}
        {uditch && (
          <article className="admin-card">
            <h3 style={{ marginTop: 0 }}>Proyek U-Ditch</h3>
            <p className="muted small">Cashflow U-Ditch per sumber dana, PIC transfer, dan impor Excel.</p>
            <div className="qc-row-actions"><Link href="/anak-usaha/uditch" className="btn btn-primary btn-sm">Cashflow U-Ditch</Link></div>
          </article>
        )}
      </div>
    </>
  );
}
