// Kartu tugas muatan — sama dengan JobCard di app.kirimistanablock.com (Muatan & tugas sopir).
import Link from "next/link";
import { LoadButton } from "@/components/ops/delivery/LoadButton";
import { navUrl } from "@/lib/erp/driver";
import { formatQty, tgl } from "@/lib/erp/util";
import type { MuatJob } from "@/lib/ops/muatanBoard";

export const JOB_STATUS: Record<string, { label: string; tone: string }> = {
  dijadwalkan: { label: "Sopir ditugaskan", tone: "st-wait" },
  dimuat: { label: "Siap berangkat", tone: "st-load" },
  berangkat: { label: "Dalam perjalanan", tone: "st-road" },
  tertunda: { label: "Terlambat", tone: "st-warn" },
  tiba: { label: "Sampai lokasi", tone: "st-done" },
  terkirim: { label: "Selesai", tone: "st-done" },
  batal: { label: "Dibatalkan", tone: "st-cancel" },
};

export const jam = (sec: number | null) =>
  sec ? new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(sec * 1000)) : "";

export function JobCard({ j, canLoad, office }: { j: MuatJob; canLoad: boolean; office: boolean }) {
  const st = j.status === "dijadwalkan" && !j.driver ? { label: "Belum ditugaskan", tone: "st-wait" } : JOB_STATUS[j.status] ?? { label: j.status, tone: "st-wait" };
  const nav = navUrl(j);
  const city = j.project || j.address.split("\n")[0] || "Alamat tujuan";
  const qtyText = j.lines.map((l) => `${l.name} · ${formatQty(l.qty)} ${l.unit}`);
  return (
    <article className="mj-card">
      <div className="mj-top">
        <div style={{ minWidth: 0 }}>
          <p className="mj-po">{j.orderNumber}{j.isInternal ? <span className="badge badge-info" style={{ marginLeft: 6 }}>INTERNAL</span> : null}</p>
          <h3>{j.contactName}</h3>
          <p className="small muted">Kirim {tgl(j.date)}</p>
        </div>
        <span className={`ohome-status ${st.tone}`}>{st.label}</span>
      </div>
      <div className="mj-load">
        <span className="small muted">Muatan</span>
        {qtyText.length ? qtyText.map((t, i) => <b key={i}>{t}</b>) : <b>-</b>}
      </div>
      <div className="mj-two">
        <div className="mj-box">
          <span className="small muted">Sopir</span>
          <b>{j.driver ?? "Belum ditugaskan"}</b>
          {j.driverPhone && <a href={`tel:${j.driverPhone}`} className="small">📞 {j.driverPhone}</a>}
        </div>
        <div className="mj-box">
          <span className="small muted">Kendaraan</span>
          <b>{j.plate ?? "Belum dipilih"}</b>
          {j.vehicleName && <span className="small muted">{j.vehicleName}</span>}
        </div>
      </div>
      <div className="mj-box mj-dest">
        <div style={{ minWidth: 0, flex: 1 }}>
          <span className="small muted">Tujuan</span>
          <b>{city}</b>
          {j.address && <span className="small muted">{j.address}</span>}
          <span className={`small ${j.mapsUrl ? "text-ok" : "text-bahaya"}`}>{j.mapsUrl ? "📍 Share Location tersimpan" : "Lokasi belum presisi"}</span>
        </div>
        {nav && <a href={nav} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Peta</a>}
      </div>
      {j.note && <p className="mj-note">Catatan: {j.note}</p>}
      {(j.departedAt || j.arrivedAt || j.deliveredAt) && (
        <p className="small muted">{[j.departedAt && `Berangkat ${jam(j.departedAt)}`, j.arrivedAt && `Tiba ${jam(j.arrivedAt)}`, j.deliveredAt && `Selesai ${jam(j.deliveredAt)}`].filter(Boolean).join(" · ")}</p>
      )}
      {j.status === "tertunda" && j.delayReason && <p className="small text-warn">Tertunda: {j.delayReason}</p>}
      {canLoad && j.status === "dijadwalkan" && j.driver && <div className="mu-act"><LoadButton id={j.id} /></div>}
      {canLoad && j.status === "dijadwalkan" && !j.driver && <p className="small muted">Kantor belum menugaskan sopir.</p>}
      {j.loadedAt && (
        <div className="mj-loaded">
          <span><b>Dimuat</b>{j.loadedByName ? ` · ${j.loadedByName}` : ""} · {jam(j.loadedAt)}{j.loadNote ? ` · ${j.loadNote}` : ""}</span>
          {canLoad && j.status === "dimuat" && <LoadButton id={j.id} to="dijadwalkan" label="Batalkan dimuat" className="btn btn-ghost btn-sm" />}
        </div>
      )}
      {office && <Link href={`/operasional/pengiriman/${j.id}`} className="btn btn-ghost btn-sm">{j.status === "terkirim" ? "Lihat detail" : "Kelola pengiriman"}</Link>}
    </article>
  );
}

export function TotalsCard({ title, totals }: { title: string; totals: { name: string; unit: string; qty: number; trips: number }[] }) {
  if (!totals.length) return null;
  return (
    <section className="mj-totals">
      <p>{title}</p>
      <div>{totals.map((t) => <span key={`${t.name}|${t.unit}`}><b>{t.name}</b> {formatQty(t.qty)} {t.unit} · {t.trips} rit</span>)}</div>
    </section>
  );
}
