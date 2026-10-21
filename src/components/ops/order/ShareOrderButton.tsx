"use client";

import { useState } from "react";
import { createTrackingLink } from "@/app/operasional/actions/deliveries";
import { formatLoad, toWhatsAppNumber } from "@/lib/ops/shared/format";
import { tgl } from "@/lib/erp/util";

export type ShareInfo = {
  number: string;
  customerName: string;
  customerPhone: string;
  lines: { name: string; qty: number; unit: string }[];
  address: string;
  mapsUrl: string;
  requestedDate: string | null;
  driverName: string | null;
  driverPhone: string | null;
  plate: string | null;
  /** Surat jalan aktif (belum terkirim/batal) untuk tautan lacak; null bila tidak ada. */
  trackDeliveryId: string | null;
  trackDeliveryNumber: string | null;
};

/** Teks WhatsApp untuk pelanggan: muatan, tujuan, jadwal, sopir. TANPA harga atau nominal apa pun. */
export function buildShareMessage(i: ShareInfo, trackingUrl?: string) {
  const rows = [
    `Halo ${i.customerName || "Bapak/Ibu"},`,
    "berikut detail pesanan Anda dari PT Istana Block Purwakarta:",
    "",
    `No. PO   : ${i.number}`,
    ...i.lines.map((l, n) => `${n === 0 ? "Muatan   :" : "          "} ${l.name} · ${formatLoad(l.qty, l.unit)}`),
    `Tujuan   : ${i.address || "Diambil sendiri"}`,
    `Jadwal   : ${i.requestedDate ? tgl(i.requestedDate) : "Belum dijadwalkan"}`,
  ];
  if (i.mapsUrl) rows.push(`Peta     : ${i.mapsUrl}`);
  rows.push("", `Sopir    : ${i.driverName || "Belum ditugaskan"}`, `No. HP   : ${i.driverPhone || "-"}`, `Kendaraan: ${i.plate || "-"}`);
  if (trackingUrl) rows.push("", "Pantau posisi pengiriman di sini:", trackingUrl);
  return rows.join("\n");
}

/** Bagikan detail PO ke pelanggan lewat WhatsApp (teks boleh diubah dulu). Tautan lacak publik bersifat opsional. */
export function ShareOrderButton({ info }: { info: ShareInfo }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const phone = toWhatsAppNumber(info.customerPhone);

  const addTracking = async () => {
    if (!info.trackDeliveryId) return;
    setBusy(true);
    setErr(null);
    const r = await createTrackingLink(info.trackDeliveryId);
    setBusy(false);
    if (r.error || !r.path) return setErr(r.error ?? "Tautan gagal dibuat.");
    setMessage(buildShareMessage(info, `${window.location.origin}${r.path}`));
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr("Gagal menyalin; salin manual dari kotak teks.");
    }
  };

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => {
          setMessage(buildShareMessage(info));
          setErr(null);
          setOpen((v) => !v);
        }}
        aria-expanded={open}
      >
        Bagikan via WhatsApp
      </button>
      {open && (
        <section className="admin-card stack" style={{ gap: 10, flexBasis: "100%", maxWidth: 560 }} aria-label="Bagikan detail pesanan">
          <h2 style={{ fontSize: 17 }}>Bagikan detail ke pelanggan</h2>
          <p className="small muted">Periksa teks sebelum dikirim; boleh diubah. Teks tidak memuat harga.</p>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={12} style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, lineHeight: 1.5 }} aria-label="Isi pesan WhatsApp" />
          {err && <p className="alert alert-error" role="alert">{err}</p>}
          <div className="head-actions">
            <a className="btn btn-primary btn-sm" href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">Kirim lewat WhatsApp</a>
            <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>{copied ? "Tersalin" : "Salin teks"}</button>
            {info.trackDeliveryId && (
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={addTracking}>{busy ? "Membuat…" : `Sertakan tautan lacak (${info.trackDeliveryNumber})`}</button>
            )}
          </div>
          {!phone && <p className="small text-warn">Pelanggan belum punya nomor HP; WhatsApp akan meminta Anda memilih kontak.</p>}
        </section>
      )}
    </>
  );
}
