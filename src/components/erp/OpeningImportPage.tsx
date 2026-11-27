// Halaman impor saldo awal per faktur (dipakai Penjualan → piutang dan Pembelian → hutang) + daftar batch dengan tombol batalkan.
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ActionButton } from "@/components/erp/ActionButton";
import { OpeningImport } from "@/components/erp/OpeningImport";
import { BackLink, PageHead } from "@/components/erp/ui";
import { cancelOpeningBatch } from "@/app/akuntansi/actions/openingImport";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import type { OpeningKind } from "@/lib/erp/openingImport";
import { today } from "@/lib/erp/util";

const rp = (n: number) => (n < 0 ? `(${Math.abs(n).toLocaleString("id-ID")})` : n.toLocaleString("id-ID"));

export async function OpeningImportPage({ kind }: { kind: OpeningKind }) {
  await requireModule("keuangan");
  const db = await getDb();
  const batches = await db.select().from(schema.openingBatches).where(eq(schema.openingBatches.kind, kind)).orderBy(desc(schema.openingBatches.createdAt));
  const label = kind === "piutang" ? "Piutang" : "Hutang";
  return (
    <>
      <BackLink href={kind === "piutang" ? "/akuntansi/menu/penjualan" : "/akuntansi/menu/pembelian"}>{kind === "piutang" ? "Penjualan" : "Pembelian"}</BackLink>
      <PageHead title={`Impor Saldo Awal ${label} per Faktur`} sub={`Mengganti saldo total ${label.toLowerCase()} dari Zahir dengan rincian faktur terbuka per ${kind === "piutang" ? "pelanggan" : "pemasok"}, supaya umur ${label.toLowerCase()}, kartu, dan penagihan berjalan.`}>
        <Link href={kind === "piutang" ? "/akuntansi/laporan/piutang" : "/akuntansi/laporan/hutang"} className="btn btn-ghost btn-sm">Laporan umur {label.toLowerCase()}</Link>
      </PageHead>
      <OpeningImport kind={kind} defaultAsOf={today()} />
      <section className="zd-card" style={{ marginTop: 16 }}>
        <h2>Riwayat impor</h2>
        {batches.length ? (
          <div className="admin-table">
            <table className="compact">
              <thead><tr><th>Diimpor</th><th>Posisi</th><th>File</th><th className="num">Faktur</th><th className="num">Total</th><th className="num">Saldo akun</th><th className="num">Selisih</th><th>Alasan</th><th>Oleh</th><th /></tr></thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className={b.cancelledAt ? "muted" : ""}>
                    <td>{b.createdAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" })}</td>
                    <td>{b.asOf}</td><td className="small">{b.fileName || "-"}</td>
                    <td className="num">{b.rowCount}</td><td className="num">{rp(b.total)}</td><td className="num">{rp(b.glBalance)}</td><td className="num">{b.difference ? rp(b.difference) : "0"}</td>
                    <td className="small">{b.reason || "-"}</td><td className="small">{b.createdByName}</td>
                    <td>{b.cancelledAt ? <span className="small">Dibatalkan{b.cancelledByName ? ` oleh ${b.cancelledByName}` : ""}</span> : <ActionButton action={cancelOpeningBatch.bind(null, b.id)} label="Batalkan impor" confirmText={`Batalkan impor ini? ${b.rowCount} faktur saldo awal akan dihapus.`} className="link-btn" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="small muted">Belum ada impor.</p>}
      </section>
    </>
  );
}
