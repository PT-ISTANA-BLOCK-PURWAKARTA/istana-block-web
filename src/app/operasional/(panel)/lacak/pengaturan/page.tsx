import Link from "next/link";
import { headers } from "next/headers";
import { asc, sql } from "drizzle-orm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { GpsKeyForm } from "@/components/ops/GpsKeyForm";
import { getDb, schema } from "@/db";
import { requireOwner } from "@/lib/auth";
import { gpsKeyHint } from "@/lib/erp/tracking";

export const metadata = { title: "Pengaturan GPS" };

export default async function GpsSetup() {
  await requireOwner();
  const db = await getDb();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? "istanablockpurwakarta.com"}`;
  const [hint, vehicles, last] = await Promise.all([
    gpsKeyHint(db),
    db.select().from(schema.vehicles).orderBy(asc(schema.vehicles.plate)),
    db.all<{ vehicleId: string; at: number; source: string; n: number }>(sql`select vehicle_id vehicleId, max(at) at, source, count(*) n from ops_positions group by vehicle_id`),
  ]);
  const lastBy = new Map(last.map((r) => [r.vehicleId, r]));
  const fmt = (t: number) => new Date(t * 1000).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
  return (
    <>
      <BackLink href="/operasional/lacak">Lacak truk</BackLink>
      <PageHead title="Pengaturan GPS" sub="Menyambungkan alat GPS di truk atau HP sopir ke peta Lacak truk." />
      <div className="stack" style={{ gap: 16, maxWidth: 980 }}>
        <section className="admin-card">
          <div className="card-head"><h2>1. Kunci penerima data</h2></div>
          <GpsKeyForm origin={origin} hint={hint} />
        </section>

        <section className="admin-table">
          <table>
            <caption>2. ID perangkat tiap truk</caption>
            <thead><tr><th>Truk</th><th>ID perangkat GPS</th><th>Posisi terakhir</th><th className="num">Ubah</th></tr></thead>
            <tbody>
              {vehicles.map((v) => {
                const l = lastBy.get(v.id);
                return (
                  <tr key={v.id}>
                    <td><b>{v.plate}</b>{!v.active && <span className="muted small"> (nonaktif)</span>}<div className="small muted">{v.name}</div></td>
                    <td>{v.gpsDeviceId ? <code>{v.gpsDeviceId}</code> : <span className="muted small">belum diisi</span>}</td>
                    <td className="small">{l ? <>{fmt(Number(l.at))}<div className="muted">{Number(l.n).toLocaleString("id-ID")} titik tersimpan</div></> : <span className="muted">belum pernah</span>}</td>
                    <td className="num"><Link href={`/operasional/armada/${v.id}`} className="btn btn-ghost btn-sm">Isi ID</Link></td>
                  </tr>
                );
              })}
              {vehicles.length === 0 && <tr><td colSpan={4} className="muted">Belum ada armada. Tambahkan di Operasional → Armada.</td></tr>}
            </tbody>
          </table>
        </section>

        <section className="admin-card prose-small">
          <div className="card-head"><h2>3. Cara menyambungkan</h2></div>
          <ol className="steps">
            <li>
              <b>Alat GPS atau server vendor yang bisa meneruskan data lewat internet (HTTP).</b> Banyak alat dan server pelacak (termasuk Traccar) bisa diatur
              mengirim posisi ke alamat lain dengan format <i>OsmAnd</i>. Isi alamat server dari langkah 1, dan pastikan ID yang dikirim alat sama dengan
              ID perangkat di tabel di atas (biasanya IMEI, tertera di stiker alat atau di aplikasi vendor).
            </li>
            <li>
              <b>Vendor hanya menyediakan aplikasi atau web mereka sendiri.</b> Tanyakan ke vendor apakah ada <i>API</i> atau fitur <i>forward/webhook</i> posisi.
              Minta dokumentasinya (alamat API, cara mendapat token, contoh data). Penyambungan lewat API vendor perlu sedikit penyesuaian kode
              sesuai dokumen tersebut.
            </li>
            <li>
              <b>HP sopir sebagai pelacak, tetap jalan di latar belakang.</b> Pasang aplikasi gratis <i>Traccar Client</i> (Android &amp; iPhone).
              Isi <i>Server URL</i> dengan alamat dari langkah 1, <i>Device identifier</i> dengan ID perangkat truk yang biasa ia bawa, frekuensi 30–60 detik,
              lalu nyalakan layanannya.
            </li>
            <li>
              <b>Tanpa aplikasi tambahan.</b> Sopir yang masuk dengan nomor HP &amp; PIN bisa menekan <i>Bagikan lokasi</i> di halaman tugasnya. Lokasi
              hanya terkirim selama halaman itu terbuka dan surat jalannya berstatus dalam perjalanan.
            </li>
          </ol>
          <p className="small muted">
            Uji cepat dari komputer: <code>{origin}/api/lacak/gps?key=KUNCI&amp;id=ID_PERANGKAT&amp;lat=-6.5569&amp;lon=107.4431</code>. Jawaban <code>{"\"ok\": true"}</code> berarti
            posisi diterima dan truk muncul di peta. Riwayat posisi disimpan 120 hari.
          </p>
        </section>
      </div>
    </>
  );
}
