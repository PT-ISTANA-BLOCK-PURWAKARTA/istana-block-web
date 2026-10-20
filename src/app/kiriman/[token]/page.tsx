import "../kiriman.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { AutoRefresh } from "@/components/ops/delivery/AutoRefresh";
import { Steps } from "@/components/ops/delivery/Steps";
import { TrackMap } from "@/components/ops/delivery/TrackMap";
import { STATUS_LABEL } from "@/components/ops/delivery/status";
import { getDb } from "@/db";
import { formatQty, tgl } from "@/lib/erp/util";
import { TOKEN_RE, trackingData } from "@/lib/ops/deliveries";
import { toWhatsAppNumber } from "@/lib/ops/shared/format";
import { getSettings } from "@/lib/settings";

// Halaman publik berbasis token rahasia: tanpa login, tidak boleh diindeks, tidak boleh di-cache.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lacak pengiriman", robots: { index: false, follow: false, nocache: true } };

const HEADLINE: Record<string, string> = {
  dijadwalkan: "Pengiriman sudah dijadwalkan",
  dimuat: "Barang sudah dimuat, menunggu berangkat",
  berangkat: "Truk sedang dalam perjalanan",
  tiba: "Truk sudah tiba di lokasi",
  tertunda: "Pengiriman tertunda",
  terkirim: "Barang sudah diterima",
  batal: "Pengiriman dibatalkan",
};

const wib = (t: number | null) => (t ? new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(t * 1000)) : null);

function ago(sec: number) {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - sec);
  if (s < 90) return "baru saja";
  if (s < 3600) return `${Math.round(s / 60)} menit lalu`;
  if (s < 86400) return `${Math.round(s / 3600)} jam lalu`;
  return `${Math.round(s / 86400)} hari lalu`;
}

export default async function Kiriman({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) notFound();
  const db = await getDb();
  const t = await trackingData(db, token);
  if (!t) notFound();
  const site = await getSettings();
  // Langkah yang menyala: "tertunda" dibaca dari jejak waktunya.
  const stepStatus = t.status === "tertunda" ? (t.arrivedAt ? "tiba" : t.departedAt ? "berangkat" : t.loadedAt ? "dimuat" : "dijadwalkan") : t.status;
  const wa = t.driver?.phone ? toWhatsAppNumber(t.driver.phone) : "";
  const tel = t.driver?.phone ? t.driver.phone.replace(/[^\d+]/g, "") : "";
  const officeWa = toWhatsAppNumber(site.whatsapp);
  const photos = Array.from({ length: t.proofCount }, (_, i) => i);
  const times: [string, string | null][] = [
    ["Dimuat", wib(t.loadedAt)],
    ["Berangkat", wib(t.departedAt)],
    ["Tiba", wib(t.arrivedAt)],
    ["Selesai", wib(t.deliveredAt)],
  ];
  return (
    <div className="kr">
      <AutoRefresh seconds={30} />
      <header className="kr-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-istana-block-putih.webp" alt="Istana Block Purwakarta" width={112} height={34} />
        <span>Lacak pengiriman</span>
      </header>
      <main className="kr-wrap">
        <section className="kr-card">
          <p className="kr-sub">Surat jalan {t.number}</p>
          <h1>{HEADLINE[t.status] ?? STATUS_LABEL[t.status as keyof typeof STATUS_LABEL] ?? t.status}</h1>
          {t.status === "batal" ? <p className="kr-bad">Pengiriman ini dibatalkan. Hubungi kami bila ada pertanyaan.</p> : <Steps status={stepStatus} />}
          {t.status === "tertunda" && <p className="kr-warn">Tertunda{t.delayReason ? `: ${t.delayReason}` : ""}. Kami akan melanjutkan secepatnya.</p>}
          {t.status === "terkirim" && <p className="kr-ok">Diterima{t.receivedBy ? ` oleh ${t.receivedBy}` : ""}{t.deliveredAt ? ` · ${wib(t.deliveredAt)}` : ""}. Terima kasih.</p>}
        </section>

        <section className="kr-card">
          <h2>Muatan</h2>
          <ul className="kr-lines">
            {t.items.map((l, i) => <li key={i}><b>{formatQty(l.qty)} {l.unit}</b><span>{l.name}</span></li>)}
          </ul>
          <dl className="kr-times">
            <dt>Untuk</dt><dd>{t.contactName}</dd>
            <dt>Tujuan</dt><dd>{[t.project, t.address.split("\n")[0]].filter(Boolean).join(" · ") || "Diambil sendiri"}</dd>
            <dt>Jadwal</dt><dd>{tgl(t.date)}</dd>
          </dl>
        </section>

        {(t.driver || t.vehicle) && (
          <section className="kr-card">
            <h2>Sopir &amp; kendaraan</h2>
            <dl className="kr-times">
              {t.driver && (<><dt>Sopir</dt><dd>{t.driver.name}</dd></>)}
              {t.vehicle && (<><dt>Kendaraan</dt><dd>{t.vehicle.plate}{t.vehicle.name ? ` · ${t.vehicle.name}` : ""}</dd></>)}
            </dl>
            {t.driver?.phone && t.status !== "terkirim" && t.status !== "batal" && (
              <div className="kr-actions">
                <a className="kr-btn" href={`tel:${tel}`}>Telepon sopir</a>
                <a className="kr-btn" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">WhatsApp sopir</a>
              </div>
            )}
          </section>
        )}

        {times.some(([, v]) => v) && (
          <section className="kr-card">
            <h2>Waktu</h2>
            <dl className="kr-times">
              {times.filter(([, v]) => v).map(([k, v]) => (
                <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>
              ))}
            </dl>
          </section>
        )}

        {(t.position || t.dest) && t.status !== "batal" && t.status !== "terkirim" && (
          <section className="kr-card">
            <h2>Posisi truk</h2>
            <TrackMap lat={t.position?.lat ?? null} lng={t.position?.lng ?? null} destLat={t.dest?.[0] ?? null} destLng={t.dest?.[1] ?? null} plate={t.vehicle?.plate ?? "Truk"} />
            <p className="kr-sub">
              {t.position ? `Posisi terakhir ${ago(t.position.at)}. ` : "Posisi truk belum tersedia. "}
              {t.position && <a href={`https://www.google.com/maps?q=${t.position.lat},${t.position.lng}`} target="_blank" rel="noopener noreferrer">Buka di Google Maps</a>}
            </p>
          </section>
        )}
        {!t.position && !t.dest && t.mapsUrl && /^https?:\/\//.test(t.mapsUrl) && t.status !== "batal" && t.status !== "terkirim" && (
          <section className="kr-card">
            <h2>Lokasi tujuan</h2>
            <div className="kr-actions"><a className="kr-btn" href={t.mapsUrl} target="_blank" rel="noopener noreferrer">Buka peta tujuan</a></div>
          </section>
        )}

        {photos.length > 0 && (
          <section className="kr-card">
            <h2>Foto bukti</h2>
            <div className="kr-photos">
              {photos.map((i) => (
                <a key={i} href={`/kiriman/${token}/foto/${i}`} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/kiriman/${token}/foto/${i}`} alt={`Foto bukti ${i + 1}`} loading="lazy" />
                </a>
              ))}
            </div>
          </section>
        )}

        <p className="kr-foot">
          Halaman ini diperbarui otomatis tiap 30 detik.{officeWa && <> Ada pertanyaan? <a href={`https://wa.me/${officeWa}`} target="_blank" rel="noopener noreferrer">Hubungi kantor kami</a>.</>}
        </p>
      </main>
    </div>
  );
}
