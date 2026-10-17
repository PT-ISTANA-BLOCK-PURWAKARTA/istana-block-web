import Link from "next/link";
import { notFound } from "next/navigation";
import { Ok, Status } from "@/components/erp/ui";
import { DriverActions } from "@/components/ops/DriverActions";
import { LocationShare } from "@/components/ops/LocationShare";
import { Icon } from "@/components/panel/Icon";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import { driverTrips, navUrl, phoneIn } from "@/lib/erp/driver";
import { formatQty, tgl } from "@/lib/erp/util";

export const metadata = { title: "Surat jalan" };

export default async function TugasDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const me = await requirePerm("antar");
  const { id } = await params;
  const { ok } = await searchParams;
  if (!me.driverId) notFound();
  const db = await getDb();
  const [t] = await driverTrips(db, me.driverId, id);
  if (!t) notFound();
  const nav = navUrl(t);
  const siteTel = phoneIn(t.siteContact);
  const custTel = phoneIn(t.contactPhone);
  return (
    <>
      <Link href="/operasional/tugas" className="login-back"><Icon name="back" size={16} /> Semua tugas</Link>
      <Ok ok={ok} />
      <div className="driver-head">
        <h1>{t.number}</h1>
        <p><Status s={t.status} /> <span className="muted">{tgl(t.date)}{t.plate ? ` · ${t.plate}` : ""}</span></p>
      </div>

      <section className="driver-card">
        <h2>Antar ke</h2>
        <p className="trip-who">{t.contactName}</p>
        {t.project && <p>{t.project}</p>}
        <p className="pre">{t.address || "Alamat belum diisi. Hubungi admin."}</p>
        {t.siteContact && <p className="small">Kontak lokasi: {t.siteContact}</p>}
        <div className="trip-quick">
          {nav && <a href={nav} target="_blank" rel="noopener" className="btn btn-blue btn-sm"><Icon name="route" size={16} /> Buka peta</a>}
          {siteTel && <a href={`tel:${siteTel}`} className="btn btn-ghost btn-sm"><Icon name="phone" size={16} /> Kontak lokasi</a>}
          {!siteTel && custTel && <a href={`tel:${custTel}`} className="btn btn-ghost btn-sm"><Icon name="phone" size={16} /> Pelanggan</a>}
        </div>
      </section>

      <section className="driver-card">
        <h2>Muatan</h2>
        <ul className="load-lines">
          {t.lines.map((l, i) => (
            <li key={i}><b className="tabular">{formatQty(l.qty)} {l.unit}</b><span>{l.name}</span></li>
          ))}
        </ul>
        {(t.note || t.orderNote) && <p className="small pre muted">{[t.note, t.orderNote].filter(Boolean).join("\n")}</p>}
      </section>

      {t.status === "berangkat" && <LocationShare />}

      {t.status === "terkirim" ? (
        <section className="driver-card">
          <h2>Sudah terkirim</h2>
          <p>Diterima oleh <b>{t.receivedBy || "–"}</b>{t.deliveredAt ? ` · ${new Date(t.deliveredAt * 1000).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}` : ""}</p>
          {t.proofKey && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/operasional/bukti/${t.proofKey}`} alt="Foto bukti terima" className="proof-img" />
          )}
        </section>
      ) : (
        <DriverActions id={t.id} status={t.status} />
      )}
    </>
  );
}
