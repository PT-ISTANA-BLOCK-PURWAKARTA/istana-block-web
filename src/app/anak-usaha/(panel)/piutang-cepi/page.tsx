import { desc, sql } from "drizzle-orm";
import { PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { can } from "@/lib/roles";
import { tambahPiutangCepi, hapusPiutangCepi } from "./actions";

export const metadata = { title: "Piutang Cepi" };

const rupiah = (n: number | null | undefined) => "Rp " + Math.round(n ?? 0).toLocaleString("id-ID");
const JENIS: Record<string, string> = { pinjam: "Pinjam dana", bayar: "Bayar piutang" };
const hariIni = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

export default async function PiutangCepi() {
  const { user } = await opsAccess();
  const boleh = can(user.roles, "keuangan");
  const db = await getDb();
  const [ringkas, rows] = await Promise.all([
    db.all<{ pinjam: number; bayar: number }>(sql`
      select coalesce(sum(case when kind = 'pinjam' then amount else 0 end), 0) pinjam,
             coalesce(sum(case when kind = 'bayar' then amount else 0 end), 0) bayar
        from ops_cepi_loans`),
    db.select().from(schema.cepiLoans).orderBy(desc(schema.cepiLoans.entryDate), desc(schema.cepiLoans.id)).limit(200),
  ]);
  const r = ringkas[0] ?? { pinjam: 0, bayar: 0 };
  const sisa = r.pinjam - r.bayar;
  return (
    <>
      <PageHead title="Piutang Cepi" sub="Dana Istana Block yang dipinjam Cepi di luar dana operasional mobil, beserta cicilan / potongan gajinya." />
      <div className="card" style={{ padding: 16, marginBottom: 20, display: "grid", gap: 6 }}>
        <strong style={{ fontSize: 22 }}>{rupiah(sisa)}</strong>
        <p className="muted" style={{ margin: 0 }}>
          Pinjam {rupiah(r.pinjam)} · dibayar {rupiah(r.bayar)}.
        </p>
      </div>
      {boleh && (
        <form action={tambahPiutangCepi} className="card" style={{ padding: 16, marginBottom: 20, display: "grid", gap: 10 }}>
          <strong>Catat pinjaman / pembayaran piutang</strong>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input name="tanggal" type="date" defaultValue={hariIni()} required style={{ flex: 1, minWidth: 150 }} aria-label="Tanggal" />
            <select name="jenis" defaultValue="pinjam" style={{ flex: 1, minWidth: 160 }} aria-label="Jenis">
              <option value="pinjam">Pinjam dana</option>
              <option value="bayar">Bayar piutang</option>
            </select>
            <input name="jumlah" inputMode="numeric" placeholder="Jumlah (Rp)" required style={{ flex: 1, minWidth: 150 }} />
            <input name="cara" placeholder="Cara bayar (mis. potong gaji)" style={{ flex: 2, minWidth: 180 }} />
            <input name="catatan" placeholder="Catatan" style={{ flex: 2, minWidth: 180 }} />
          </div>
          <div><button type="submit" className="btn">Simpan</button></div>
        </form>
      )}
      <div className="admin-table">
        <table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Jenis</th>
              <th style={{ textAlign: "right" }}>Jumlah</th>
              <th>Cara bayar</th>
              <th>Catatan</th>
              <th>Dicatat oleh</th>
              {boleh && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.entryDate}</td>
                <td>{JENIS[row.kind] ?? row.kind}</td>
                <td style={{ textAlign: "right" }}>{rupiah(row.amount)}</td>
                <td>{row.method || "-"}</td>
                <td>{row.note || "-"}</td>
                <td>{row.createdByName || "-"}</td>
                {boleh && (
                  <td>
                    <form action={hapusPiutangCepi}>
                      <input type="hidden" name="id" value={row.id} />
                      <button type="submit" className="link">Hapus</button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={boleh ? 7 : 6} className="muted">Belum ada pinjaman / pembayaran piutang Cepi.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
