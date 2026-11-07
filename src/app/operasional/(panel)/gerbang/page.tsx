import { desc, sql } from "drizzle-orm";
import { PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";

export const metadata = { title: "Buku gerbang" };

/** OUT = keluar pabrik, IN = kembali ke pabrik (padanan `vehicleTrips` app lama). */
const KEPERLUAN: Record<string, string> = {
  kirim: "Kirim (PO)",
  belanja: "Belanja",
  antar: "Antar barang",
  survey: "Survey / sampel",
  lain: "Lainnya",
};

const ops = { timeZone: "Asia/Jakarta" } as const;
const jam = (d: Date | null) => (d ? d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", ...ops }) : "-");
const tanggal = (d: Date | null) => (d ? d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", ...ops }) : "-");
/** IN pada hari berbeda ikut menampilkan tanggalnya. */
const jamMasuk = (keluar: Date | null, masuk: Date | null) => {
  if (!masuk) return "belum kembali";
  const beda = !keluar || keluar.toLocaleDateString("id-ID", ops) !== masuk.toLocaleDateString("id-ID", ops);
  return beda ? `${masuk.toLocaleDateString("id-ID", { day: "2-digit", month: "short", ...ops })} ${jam(masuk)}` : jam(masuk);
};
const lama = (keluar: Date | null, masuk: Date | null) => {
  if (!keluar || !masuk) return "-";
  const menit = Math.round((masuk.getTime() - keluar.getTime()) / 60000);
  if (menit < 0) return "-";
  const h = Math.floor(menit / 60);
  return h ? `${h}j ${menit % 60}m` : `${menit}m`;
};

export default async function Gerbang() {
  await opsAccess();
  const db = await getDb();
  const [perMobil, rows] = await Promise.all([
    db.all<{ plate: string | null; n: number }>(sql`select plate, count(*) n from ops_vehicle_trips group by plate order by n desc limit 8`),
    db.select().from(schema.vehicleTrips).orderBy(desc(schema.vehicleTrips.outAt), desc(schema.vehicleTrips.id)).limit(100),
  ]);
  const belumKembali = rows.filter((r) => r.outAt && !r.inAt).length;
  return (
    <>
      <PageHead
        title="Buku gerbang"
        sub={`${rows.length} rit terakhir${belumKembali ? ` · ${belumKembali} belum tercatat kembali` : ""}. OUT = keluar pabrik, IN = kembali ke pabrik.`}
      />
      {perMobil.length > 0 && (
        <div className="admin-table" style={{ marginBottom: 16 }}>
          <table>
            <thead><tr><th>Rit per mobil</th><th style={{ textAlign: "right" }}>Rit</th></tr></thead>
            <tbody>
              {perMobil.map((r) => (
                <tr key={r.plate ?? "-"}><td>{r.plate || "-"}</td><td style={{ textAlign: "right" }}>{r.n}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="admin-table">
        <table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>No polisi</th>
              <th>Sopir</th>
              <th>Barang / keperluan</th>
              <th>Tujuan</th>
              <th>OUT</th>
              <th>IN</th>
              <th>Lama</th>
              <th>Dicatat</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{tanggal(r.outAt)}</td>
                <td>{r.plate || "-"}</td>
                <td>{r.driverName || "-"}</td>
                <td>{r.cargo || KEPERLUAN[r.purpose] || r.purpose}</td>
                <td>{r.destination || "-"}</td>
                <td>{jam(r.outAt)}</td>
                <td>{jamMasuk(r.outAt, r.inAt)}</td>
                <td>{lama(r.outAt, r.inAt)}</td>
                <td>{[r.outByName && `out ${r.outByName}`, r.inByName && `in ${r.inByName}`].filter(Boolean).join(" · ") || "-"}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={9} className="muted">Belum ada catatan keluar-masuk kendaraan.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
