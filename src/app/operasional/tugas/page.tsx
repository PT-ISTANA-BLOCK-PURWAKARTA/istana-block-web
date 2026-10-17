import Link from "next/link";
import { Status } from "@/components/erp/ui";
import { Icon } from "@/components/panel/Icon";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import { driverTrips, navUrl, phoneIn, type DriverTrip } from "@/lib/erp/driver";
import { formatQty, tgl, today } from "@/lib/erp/util";

export const metadata = { title: "Tugas antar" };

function Trip({ t }: { t: DriverTrip }) {
  const nav = navUrl(t);
  const tel = phoneIn(t.siteContact) ?? phoneIn(t.contactPhone);
  return (
    <article className={`trip-card is-${t.status}`}>
      <Link href={`/operasional/tugas/${t.id}`} className="trip-main">
        <span className="trip-top">
          <b>{t.number}</b> <Status s={t.status} />
          <span className="trip-date">{t.date === today() ? "Hari ini" : tgl(t.date)}</span>
        </span>
        <span className="trip-who">{t.contactName}</span>
        <span className="trip-where">{t.project ? `${t.project} · ` : ""}{t.address.split("\n")[0] || "Alamat belum diisi"}</span>
        <span className="trip-items">{t.lines.map((l) => `${formatQty(l.qty)} ${l.unit} ${l.name}`).join(" · ")}</span>
        {t.plate && <span className="trip-plate"><Icon name="truck" size={16} /> {t.plate}</span>}
      </Link>
      {t.status !== "terkirim" && (
        <div className="trip-quick">
          {nav && <a href={nav} target="_blank" rel="noopener" className="btn btn-ghost btn-sm"><Icon name="route" size={16} /> Peta</a>}
          {tel && <a href={`tel:${tel}`} className="btn btn-ghost btn-sm"><Icon name="phone" size={16} /> Telepon</a>}
          <Link href={`/operasional/tugas/${t.id}`} className="btn btn-primary btn-sm">{t.status === "berangkat" ? "Sudah sampai" : "Buka"}</Link>
        </div>
      )}
    </article>
  );
}

export default async function Tugas() {
  const me = await requirePerm("antar");
  if (!me.driverId) {
    return (
      <div className="driver-empty">
        <h1>Halo, {me.name.split(" ")[0]}</h1>
        <p>Akun Anda belum terhubung ke data sopir, jadi tugas antar belum bisa ditampilkan. Minta admin kantor menghubungkannya di halaman Pengguna &amp; peran.</p>
      </div>
    );
  }
  const db = await getDb();
  const trips = await driverTrips(db, me.driverId);
  const t0 = today();
  const onRoad = trips.filter((t) => t.status === "berangkat");
  const todo = trips.filter((t) => t.status === "dijadwalkan" && t.date <= t0);
  const later = trips.filter((t) => t.status === "dijadwalkan" && t.date > t0);
  const done = trips.filter((t) => t.status === "terkirim");
  return (
    <>
      <div className="driver-head">
        <h1>Tugas antar</h1>
        <p className="muted">{tgl(t0)} · {me.name}</p>
      </div>
      {onRoad.length > 0 && (
        <section className="driver-sec">
          <h2>Sedang diantar</h2>
          {onRoad.map((t) => <Trip key={t.id} t={t} />)}
        </section>
      )}
      <section className="driver-sec">
        <h2>Jadwal hari ini</h2>
        {todo.map((t) => <Trip key={t.id} t={t} />)}
        {todo.length === 0 && <p className="muted small">Tidak ada muatan yang dijadwalkan untuk Anda hari ini.</p>}
      </section>
      {later.length > 0 && (
        <section className="driver-sec">
          <h2>Berikutnya</h2>
          {later.map((t) => <Trip key={t.id} t={t} />)}
        </section>
      )}
      {done.length > 0 && (
        <section className="driver-sec">
          <h2>Sudah terkirim</h2>
          {done.map((t) => <Trip key={t.id} t={t} />)}
        </section>
      )}
    </>
  );
}
