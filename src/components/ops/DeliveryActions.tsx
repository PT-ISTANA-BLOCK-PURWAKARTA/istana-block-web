"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { setDeliveryStatus } from "@/app/operasional/actions/deliveries";
import type { DeliveryStatus } from "@/db/erp";
import { ProofInput } from "./ProofInput";

function Delivered({ id, label }: { id: string; label: string }) {
  return (
    <ActionForm action={setDeliveryStatus} className="form-section">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="to" value="terkirim" />
      <h2>{label}</h2>
      <div className="form-grid">
        <div className="field"><label htmlFor="dv-recv">Diterima oleh</label><input id="dv-recv" name="receivedBy" placeholder="nama penerima di lokasi" /></div>
        <ProofInput id="dv-proof" />
      </div>
      <div><SubmitButton className="btn btn-primary">Tandai terkirim</SubmitButton></div>
    </ActionForm>
  );
}

function Simple({ id, to, label, className = "btn btn-blue", note }: { id: string; to: DeliveryStatus; label: string; className?: string; note?: string }) {
  return (
    <ActionForm action={setDeliveryStatus} className="inline-form">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="to" value={to} />
      <SubmitButton className={className} pendingText="Memproses…">{label}</SubmitButton>
      {note && <span className="small muted">{note}</span>}
    </ActionForm>
  );
}

function Cancel({ id, label }: { id: string; label: string }) {
  return (
    <details className="danger-zone">
      <summary>{label}</summary>
      <ActionForm action={setDeliveryStatus} className="stack" style={{ gap: 10, paddingTop: 10 }}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="to" value="batal" />
        <div className="field"><label htmlFor="dv-reason">Alasan</label><input id="dv-reason" name="reason" placeholder="mis. jalan ditutup, pelanggan menunda" /></div>
        <p className="small muted">Stok yang sudah keluar dan jurnal harga pokoknya akan dikembalikan.</p>
        <div><SubmitButton className="btn btn-ghost btn-sm" pendingText="Membatalkan…">Batalkan surat jalan</SubmitButton></div>
      </ActionForm>
    </details>
  );
}

/**
 * Tombol alur status surat jalan: dijadwalkan → berangkat → terkirim (atau batal).
 * Akun gudang (tanpa izin pengiriman) hanya bisa memberangkatkan truk atau membatalkan keberangkatan.
 */
export function DeliveryActions({ id, status, canShip }: { id: string; status: DeliveryStatus; canShip: boolean }) {
  if (!canShip) {
    if (status === "dijadwalkan")
      return (
        <div className="head-actions">
          <Simple id={id} to="berangkat" label="Barang sudah dimuat, truk berangkat" className="btn btn-primary" note="Stok keluar dicatat hari ini." />
        </div>
      );
    if (status === "berangkat")
      return (
        <div className="stack" style={{ gap: 8 }}>
          <p className="small muted">Truk dalam perjalanan. Konfirmasi barang diterima dilakukan bagian pengiriman.</p>
          <div className="head-actions"><Simple id={id} to="dijadwalkan" label="Batal berangkat (bongkar kembali)" className="btn btn-ghost btn-sm" /></div>
        </div>
      );
    return null;
  }
  if (status === "dijadwalkan")
    return (
      <div className="stack" style={{ gap: 14 }}>
        <div className="head-actions">
          <Simple id={id} to="berangkat" label="Truk berangkat" className="btn btn-primary" note="Stok keluar dicatat hari ini." />
        </div>
        <details className="form-details">
          <summary>Langsung tandai terkirim (tanpa status berangkat)</summary>
          <Delivered id={id} label="Konfirmasi barang diterima" />
        </details>
        <Cancel id={id} label="Batalkan jadwal" />
      </div>
    );
  if (status === "berangkat")
    return (
      <div className="stack" style={{ gap: 14 }}>
        <Delivered id={id} label="Barang sudah sampai?" />
        <div className="head-actions">
          <Simple id={id} to="dijadwalkan" label="Batal berangkat (kembali ke jadwal)" className="btn btn-ghost btn-sm" />
        </div>
        <Cancel id={id} label="Batalkan surat jalan" />
      </div>
    );
  if (status === "terkirim") return <Cancel id={id} label="Koreksi: batalkan surat jalan yang sudah terkirim" />;
  return <div className="head-actions"><Simple id={id} to="dijadwalkan" label="Jadwalkan ulang" className="btn btn-blue btn-sm" /></div>;
}
