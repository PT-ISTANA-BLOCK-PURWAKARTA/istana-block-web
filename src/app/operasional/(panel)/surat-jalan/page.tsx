import { PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { buatSuratJalan, hapusSuratJalan } from "./actions";
import { desc } from "drizzle-orm";

export const metadata = { title: "Surat jalan" };

export default async function SuratJalan() {
  const { canShip } = await opsAccess();
  const db = await getDb();
  const rows = await db.select().from(schema.deliveryNotes).orderBy(desc(schema.deliveryNotes.noteDate), desc(schema.deliveryNotes.number));
  const rupiah = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");
  const nilai = (items: Record<string, unknown>[]) =>
    items.reduce((n, it) => n + (typeof it.total === "number" ? (it.total as number) : 0), 0);
  return (
    <>
      <PageHead title="Surat jalan" />
      <p className="muted" style={{ marginTop: -8 }}>{rows.length} surat jalan hasil impor app lama. Cetak & buat baru belum tersedia.</p>
      {canShip && (
        <form action={buatSuratJalan} className="card" style={{ padding: 16, marginBottom: 20, display: "grid", gap: 10 }}>
          <strong>Surat jalan baru</strong>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input name="pelanggan" placeholder="Pelanggan" required style={{ flex: 2, minWidth: 200 }} />
            <input name="tanggal" type="date" required style={{ flex: 1, minWidth: 150 }} />
            <input name="po" placeholder="No. PO" style={{ flex: 1, minWidth: 140 }} />
            <input name="telepon" placeholder="Telepon" style={{ flex: 1, minWidth: 140 }} />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input name="alamat" placeholder="Alamat tujuan" style={{ flex: 2, minWidth: 220 }} />
            <input name="sopir" placeholder="Sopir" style={{ flex: 1, minWidth: 140 }} />
            <input name="plat" placeholder="Plat truk" style={{ flex: 1, minWidth: 120 }} />
            <input name="penandaTangan" placeholder="Penanda tangan" style={{ flex: 1, minWidth: 150 }} />
          </div>
          <textarea name="items" rows={3} placeholder="Barang per baris: Paving Bata 6cm|19|pcs|85000" />
          <div><button type="submit" className="btn">Simpan surat jalan</button></div>
        </form>
      )}
      <div className="admin-table">
        <table>
          <thead><tr><th>Nomor</th><th>Tanggal</th><th>Pelanggan</th><th>PO</th><th>Sopir / plat</th><th style={{ textAlign: "right" }}>Nilai barang</th><th>Catatan</th>{canShip && <th />}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.issuer.toUpperCase()}-{r.number}</td>
                <td>{r.noteDate}</td>
                <td>{r.customerName}</td>
                <td>{r.orderPoNumber || r.poNumber || "-"}</td>
                <td>{[r.driverName, r.plate].filter(Boolean).join(" · ") || "-"}</td>
                <td style={{ textAlign: "right" }}>{nilai(r.items) ? rupiah(nilai(r.items)) : "-"}</td>
                <td>{r.pickup ? "diambil sendiri" : r.isInternal ? "internal" : "-"}</td>{canShip && <td><form action={hapusSuratJalan}><input type="hidden" name="id" value={r.id} /><button type="submit" className="link">Hapus</button></form></td>}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={canShip ? 8 : 7} className="muted">Belum ada surat jalan.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
