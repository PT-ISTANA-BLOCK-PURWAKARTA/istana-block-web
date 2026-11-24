// Kasbon: karyawan pabrik (Keuangan) atau sopir (Ekspedisi Istana Block, dicatat PIC Kendaraan). Rekap sisa per nama + riwayat.
import { and, desc, eq, sql } from "drizzle-orm";
import { hapusKasbon, tambahKasbon } from "@/app/akuntansi/(panel)/kasbon/actions";
import { PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";

const rupiah = (n: number | null | undefined) => "Rp " + Math.round(n ?? 0).toLocaleString("id-ID");
const JENIS: Record<string, string> = { kasbon: "Kasbon", bayar: "Bayar" };
const KATEGORI: Record<string, string> = { utama: "Utama", bulanan: "Bulanan", mingguan: "Mingguan" };
const hariIni = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

export async function KasbonBoard({ driver, canEdit }: { driver: boolean; canEdit: boolean }) {
  const db = await getDb();
  const t = schema.kasbonEntries;
  const who = driver ? "sopir" : "karyawan";
  const [rekap, rows] = await Promise.all([
    db.all<{ employee_name: string; kasbon: number | null; bayar: number | null }>(
      sql`select employee_name,
                 sum(case when kind = 'kasbon' then amount else 0 end) kasbon,
                 sum(case when kind = 'bayar' then amount else 0 end) bayar
            from ops_kasbon_entries
           where is_driver = ${driver ? 1 : 0}
           group by employee_name
           order by employee_name`,
    ),
    db.select().from(t).where(and(eq(t.isDriver, driver))).orderBy(desc(t.entryDate), desc(t.createdAt)).limit(300),
  ]);
  const totalKasbon = rekap.reduce((n, r) => n + (r.kasbon ?? 0), 0);
  const totalBayar = rekap.reduce((n, r) => n + (r.bayar ?? 0), 0);
  return (
    <>
      <PageHead
        title={driver ? "Kasbon sopir" : "Kasbon karyawan"}
        sub={`${driver ? "Kasbon sopir Ekspedisi Istana Block (dicatat PIC Kendaraan). Kasbon karyawan pabrik ada di Keuangan." : "Kasbon karyawan pabrik (kecuali sopir). Kasbon sopir ada di Anak Perusahaan → Ekspedisi."} ${rows.length} catatan · kasbon ${rupiah(totalKasbon)} · dibayar ${rupiah(totalBayar)} · sisa ${rupiah(totalKasbon - totalBayar)}.`}
      />
      {canEdit && (
        <form action={tambahKasbon} className="card" style={{ padding: 16, marginBottom: 20, display: "grid", gap: 10 }}>
          <input type="hidden" name="sopir" value={driver ? "1" : "0"} />
          <strong>Catat kasbon / pembayaran {who}</strong>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input name="karyawan" placeholder={driver ? "Nama sopir" : "Nama karyawan"} required style={{ flex: 2, minWidth: 200 }} />
            <input name="tanggal" type="date" defaultValue={hariIni()} required style={{ flex: 1, minWidth: 150 }} aria-label="Tanggal" />
            <select name="jenis" defaultValue="kasbon" style={{ flex: 1, minWidth: 120 }} aria-label="Jenis">
              <option value="kasbon">Kasbon</option>
              <option value="bayar">Bayar</option>
            </select>
            <select name="kategori" defaultValue="utama" style={{ flex: 1, minWidth: 120 }} aria-label="Kategori">
              <option value="utama">Utama</option>
              <option value="bulanan">Bulanan</option>
              <option value="mingguan">Mingguan</option>
            </select>
            <select name="cara" defaultValue="cash" style={{ flex: 1, minWidth: 120 }} aria-label="Cara">
              <option value="cash">Cash</option>
              <option value="transfer">Transfer</option>
            </select>
            <input name="jumlah" inputMode="numeric" placeholder="Jumlah (Rp)" required style={{ flex: 1, minWidth: 150 }} />
            <input name="catatan" placeholder="Catatan" style={{ flex: 2, minWidth: 180 }} />
          </div>
          <div><button type="submit" className="btn">Simpan</button></div>
        </form>
      )}
      <div className="admin-table" style={{ marginBottom: 16 }}>
        <table>
          <thead>
            <tr><th>{driver ? "Sopir" : "Karyawan"}</th><th style={{ textAlign: "right" }}>Kasbon</th><th style={{ textAlign: "right" }}>Dibayar</th><th style={{ textAlign: "right" }}>Sisa</th></tr>
          </thead>
          <tbody>
            {rekap.map((r) => (
              <tr key={r.employee_name}>
                <td>{r.employee_name}</td>
                <td style={{ textAlign: "right" }}>{rupiah(r.kasbon)}</td>
                <td style={{ textAlign: "right" }}>{rupiah(r.bayar)}</td>
                <td style={{ textAlign: "right" }}>{rupiah((r.kasbon ?? 0) - (r.bayar ?? 0))}</td>
              </tr>
            ))}
            {!rekap.length && <tr><td colSpan={4} className="muted">Belum ada kasbon {who}.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="admin-table">
        <table>
          <thead>
            <tr><th>Tanggal</th><th>{driver ? "Sopir" : "Karyawan"}</th><th>Jenis</th><th>Kategori</th><th>Cara</th><th style={{ textAlign: "right" }}>Jumlah</th><th>Catatan</th><th>Dicatat oleh</th>{canEdit && <th />}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.entryDate}</td>
                <td>{r.employeeName}</td>
                <td>{JENIS[r.kind] ?? r.kind}</td>
                <td>{r.category ? KATEGORI[r.category] ?? r.category : "-"}</td>
                <td>{r.payMethod === "transfer" ? "Transfer" : r.payMethod === "cash" ? "Cash" : "-"}{r.fundedBy === "ib" ? " · dana PT" : ""}</td>
                <td style={{ textAlign: "right" }}>{rupiah(r.amount)}</td>
                <td>{r.note || "-"}</td>
                <td>{r.createdByName || "-"}</td>
                {canEdit && (
                  <td>
                    <form action={hapusKasbon}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="sopir" value={driver ? "1" : "0"} />
                      <button type="submit" className="link">Hapus</button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={canEdit ? 9 : 8} className="muted">Belum ada catatan kasbon.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
