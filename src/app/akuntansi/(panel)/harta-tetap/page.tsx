// Daftar Harta Tetap: harga perolehan, akumulasi penyusutan, nilai buku, dan penyusutan bulan berikutnya per aset.
import Link from "next/link";
import { ActionButton } from "@/components/erp/ActionButton";
import { Kpis, PageHead } from "@/components/erp/ui";
import { seedFromBalances } from "@/app/akuntansi/actions/assets";
import { getDb } from "@/db";
import { requireModule } from "@/lib/auth";
import { CATEGORY_LABEL, METHOD_LABEL, listAssets } from "@/lib/erp/assets";
import { formatAmount, tgl } from "@/lib/erp/util";

export const metadata = { title: "Harta Tetap" };
export const dynamic = "force-dynamic";

const life = (m: number) => (m ? `${Math.floor(m / 12)} th${m % 12 ? ` ${m % 12} bln` : ""}` : "-");

export default async function HartaTetap({ searchParams }: { searchParams: Promise<{ ok?: string; status?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const db = await getDb();
  const all = await listAssets(db);
  const showDisposed = sp.status === "semua";
  const rows = all.filter((a) => showDisposed || !a.disposedDate);
  const active = all.filter((a) => !a.disposedDate);
  const sum = (f: (a: (typeof all)[number]) => number) => active.reduce((s, a) => s + f(a), 0);
  return (
    <>
      <PageHead title="Harta Tetap" sub="Daftar aset tetap, akumulasi penyusutan dan nilai buku. Penyusutan dibukukan sebulan sekali lewat tombol Bukukan penyusutan.">
        <Link href="/akuntansi/harta-tetap/penyusutan" className="btn btn-blue btn-sm">Bukukan penyusutan</Link>
        <Link href="/akuntansi/laporan/harta-tetap" className="btn btn-ghost btn-sm">Laporan</Link>
        <Link href="/akuntansi/harta-tetap/baru" className="btn btn-primary btn-sm">+ Aset baru</Link>
      </PageHead>
      {sp.ok && <p className="alert alert-ok">Tersimpan: {sp.ok}</p>}
      <Kpis
        items={[
          { label: "Harga perolehan", value: formatAmount(sum((a) => a.cost)), sub: `${active.length} aset aktif` },
          { label: "Akumulasi penyusutan", value: formatAmount(sum((a) => a.accum)) },
          { label: "Nilai buku", value: formatAmount(sum((a) => a.book)) },
          { label: "Penyusutan bulan berikutnya", value: formatAmount(sum((a) => a.monthly)), sub: "taksiran" },
        ]}
      />
      {all.length === 0 ? (
        <section className="zd-card">
          <h2>Belum ada aset</h2>
          <p className="muted">Mulai cepat dari saldo rekening hasil Zahir (satu aset per kelompok: Tanah, Bangunan, Mesin, Kendaraan, Inventaris). Umur diatur supaya penyusutan per bulan sama dengan penyusutan Zahir bulan terakhir; setelah itu boleh dipecah per aset.</p>
          <ActionButton action={seedFromBalances} label="Buat dari saldo rekening Zahir" />
          <span style={{ margin: "0 8px" }}>atau</span>
          <Link href="/akuntansi/harta-tetap/baru" className="btn btn-ghost btn-sm">Tambah aset satu per satu</Link>
        </section>
      ) : (
        <div className="admin-table">
          <table>
            <thead><tr><th>Kode</th><th>Nama aset</th><th>Kelompok</th><th>Perolehan</th><th>Metode · umur</th><th className="num">Harga</th><th className="num">Akumulasi</th><th className="num">Nilai buku</th><th className="num">Per bulan</th></tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className={a.disposedDate ? "muted" : undefined}>
                  <td className="nowrap"><Link href={`/akuntansi/harta-tetap/${a.id}`}>{a.code}</Link></td>
                  <td>{a.name}{a.disposedDate && <div className="small text-bahaya">dijual/dihapus {tgl(a.disposedDate)}</div>}{a.location && <div className="small muted">{a.location}</div>}</td>
                  <td className="small">{CATEGORY_LABEL[a.category]}</td>
                  <td className="nowrap small">{tgl(a.acquiredDate)}</td>
                  <td className="small">{METHOD_LABEL[a.method]} · {life(a.lifeMonths)}</td>
                  <td className="num tabular">{formatAmount(a.cost)}</td>
                  <td className="num tabular">{formatAmount(a.accum)}</td>
                  <td className="num tabular">{formatAmount(a.book)}</td>
                  <td className="num tabular">{formatAmount(a.monthly, { blankZero: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {all.some((a) => a.disposedDate) && <p className="small"><Link href={`/akuntansi/harta-tetap?status=${showDisposed ? "" : "semua"}`}>{showDisposed ? "Sembunyikan aset yang sudah dijual/dihapus" : "Tampilkan juga aset yang sudah dijual/dihapus"}</Link></p>}
    </>
  );
}
