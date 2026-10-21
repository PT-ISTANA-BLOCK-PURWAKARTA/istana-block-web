import Link from "next/link";
import { notFound } from "next/navigation";
import { Ok } from "@/components/erp/ui";
import { DriverActions } from "@/components/ops/DriverActions";
import { LocationShare } from "@/components/ops/LocationShare";
import { AutoRefresh } from "@/components/ops/delivery/AutoRefresh";
import { Steps } from "@/components/ops/delivery/Steps";
import { DeliveryStatusBadge } from "@/components/ops/delivery/StatusBadge";
import { driverBase, driverNext } from "@/components/ops/delivery/status";
import { Icon } from "@/components/panel/Icon";
import { getDb } from "@/db";
import { MAX_DELIVERY_PROOFS } from "@/db/erp";
import { requirePerm } from "@/lib/auth";
import { driverTrips, navUrl, phoneIn } from "@/lib/erp/driver";
import { formatQty, tgl } from "@/lib/erp/util";
import { proofRowCount } from "@/lib/ops/deliveries";

export const metadata = { title: "Surat jalan" };

const jam = (t: number | null) => (t ? new Date(t * 1000).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "");

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
  const next = t.status === "batal" ? null : driverNext(t);
  const base = driverBase(t);
  const onRoad = t.status === "berangkat" || t.status === "tiba" || (t.status === "tertunda" && !!t.departedAt);
  const uploadCount = await proofRowCount(db, t.id);
  return (
    <>
      <AutoRefresh seconds={30} />
      <Link href="/operasional/tugas" className="login-back"><Icon name="back" size={16} /> Semua tugas</Link>
      <Ok ok={ok} />
      <div className="driver-head">
        <h1>{t.number}</h1>
        <p><DeliveryStatusBadge s={t.status} /> <span className="muted">{tgl(t.date)}{t.plate ? ` · ${t.plate}` : ""}</span></p>
      </div>
      {t.status === "batal" ? (
        <p className="alert alert-error">Surat jalan ini dibatalkan oleh kantor. Anda tidak perlu mengantarnya.</p>
      ) : (
        <Steps status={t.status === "tertunda" ? base : t.status} />
      )}
      {t.status === "tertunda" && <p className="alert alert-warn">Tertunda{t.delayReason ? `: ${t.delayReason}` : ""}</p>}

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
        {/* Catatan sudah melewati hidePrices di driverTrips: tidak ada nominal harga untuk sopir. */}
        {(t.note || t.orderNote) && <p className="small pre muted">{[t.note, t.orderNote].filter(Boolean).join("\n")}</p>}
      </section>

      {onRoad && <LocationShare />}

      {t.status === "terkirim" ? (
        <section className="driver-card">
          <h2>Sudah terkirim</h2>
          <p>Diterima oleh <b>{t.receivedBy || "–"}</b>{t.deliveredAt ? ` · ${jam(t.deliveredAt)}` : ""}</p>
          {t.proofKeys.length > 0 && (
            <div className="dl-proofs">
              {t.proofKeys.map((k, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <a key={k} href={`/operasional/bukti/${k}`} target="_blank" rel="noopener noreferrer"><img src={`/operasional/bukti/${k}`} alt={`Foto bukti ${i + 1}`} loading="lazy" /></a>
              ))}
            </div>
          )}
        </section>
      ) : (
        <DriverActions
          id={t.id}
          next={next as "dimuat" | "berangkat" | "tiba" | "terkirim" | null}
          resume={t.status === "tertunda" && base !== "dijadwalkan" ? (base as "dimuat" | "berangkat" | "tiba") : null}
          proofCount={t.proofKeys.length}
          uploadCount={uploadCount}
          maxProofs={MAX_DELIVERY_PROOFS}
        />
      )}
      {t.status !== "terkirim" && t.status !== "batal" && t.proofKeys.length > 0 && (
        <section className="driver-card">
          <h2>Foto bukti ({t.proofKeys.length})</h2>
          <div className="dl-proofs">
            {t.proofKeys.map((k, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <a key={k} href={`/operasional/bukti/${k}`} target="_blank" rel="noopener noreferrer"><img src={`/operasional/bukti/${k}`} alt={`Foto bukti ${i + 1}`} loading="lazy" /></a>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
