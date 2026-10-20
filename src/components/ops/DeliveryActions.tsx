"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { completeDelivery, setDeliveryStatus } from "@/app/operasional/actions/deliveries";
import type { DeliveryStatus } from "@/db/erp";
import { ProofInput } from "./ProofInput";

function Delivered({ id, label, optional }: { id: string; label: string; optional?: boolean }) {
  return (
    <ActionForm action={setDeliveryStatus} className="form-section">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="to" value="terkirim" />
      <h2>{label}</h2>
      <div className="form-grid">
        <div className="field"><label htmlFor="dv-recv">Diterima oleh</label><input id="dv-recv" name="receivedBy" placeholder="nama penerima di lokasi" /></div>
        <ProofInput id="dv-proof" help={optional ? "opsional, bisa ditambah dari bagian Foto bukti" : undefined} />
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

function Delay({ id }: { id: string }) {
  return (
    <details className="form-details">
      <summary>Catat tertunda</summary>
      <ActionForm action={setDeliveryStatus} className="stack" style={{ gap: 10, paddingTop: 10 }}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="to" value="tertunda" />
        <div className="field"><label htmlFor="dv-delay">Alasan tertunda</label><input id="dv-delay" name="reason" required minLength={3} maxLength={300} placeholder="mis. truk mogok, jalan ditutup, lokasi belum siap" /></div>
        <div><SubmitButton className="btn btn-ghost btn-sm" pendingText="Mencatat…">Tandai tertunda</SubmitButton></div>
      </ActionForm>
    </details>
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
        <p className="small muted">Stok yang sudah keluar dan jurnal harga pokoknya akan dikembalikan. Sopir diberi tahu.</p>
        <div><SubmitButton className="btn btn-ghost btn-sm" pendingText="Membatalkan…">Batalkan surat jalan</SubmitButton></div>
      </ActionForm>
    </details>
  );
}

function Complete({ id }: { id: string }) {
  return (
    <details className="form-details">
      <summary>Selesaikan dari kantor</summary>
      <ActionForm action={completeDelivery} className="stack" style={{ gap: 10, paddingTop: 10 }}>
        <input type="hidden" name="id" value={id} />
        <div className="field"><label htmlFor="dv-note">Catatan <span className="help">opsional</span></label><input id="dv-note" name="note" maxLength={500} placeholder="mis. pelanggan konfirmasi barang sudah diterima lewat telepon" /></div>
        <p className="small muted">Surat jalan ditandai terkirim tanpa foto atau nama penerima, dengan catatan “Diselesaikan dari kantor”.</p>
        <div><SubmitButton className="btn btn-primary btn-sm" pendingText="Menyelesaikan…">Selesaikan pengiriman</SubmitButton></div>
      </ActionForm>
    </details>
  );
}

/**
 * Tombol alur status surat jalan: dijadwalkan → dimuat → berangkat → tiba → terkirim (plus tertunda & batal).
 * - Kantor (izin pengiriman): semua langkah. Izin "selesaikan" menambah "Selesaikan dari kantor".
 * - Gudang/mandor/satpam (izin muat, tanpa pengiriman): hanya "Sudah dimuat" dan kembali ke jadwal.
 */
export function DeliveryActions({ id, status, canShip, canLoad = false, canComplete = false }: { id: string; status: DeliveryStatus; canShip: boolean; canLoad?: boolean; canComplete?: boolean }) {
  const open = status !== "terkirim" && status !== "batal";
  const complete = canComplete && open ? <Complete id={id} /> : null;

  if (!canShip) {
    if (canLoad && status === "dijadwalkan")
      return (
        <div className="stack" style={{ gap: 14 }}>
          <div className="head-actions"><Simple id={id} to="dimuat" label="Sudah dimuat" className="btn btn-primary" note="Sopir diberi tahu." /></div>
          {complete}
        </div>
      );
    if (canLoad && status === "dimuat")
      return (
        <div className="stack" style={{ gap: 8 }}>
          <p className="small muted">Barang sudah dimuat. Menunggu sopir berangkat.</p>
          <div className="head-actions"><Simple id={id} to="dijadwalkan" label="Batal dimuat (kembali ke jadwal)" className="btn btn-ghost btn-sm" /></div>
          {complete}
        </div>
      );
    return complete;
  }

  if (status === "dijadwalkan")
    return (
      <div className="stack" style={{ gap: 14 }}>
        <div className="head-actions">
          <Simple id={id} to="dimuat" label="Sudah dimuat" className="btn btn-primary" note="Sopir diberi tahu." />
          <Simple id={id} to="berangkat" label="Truk berangkat" className="btn btn-blue" note="Stok keluar dicatat hari ini." />
        </div>
        <details className="form-details">
          <summary>Langsung tandai terkirim (tanpa status berangkat)</summary>
          <Delivered id={id} label="Konfirmasi barang diterima" optional />
        </details>
        <Delay id={id} />
        {complete}
        <Cancel id={id} label="Batalkan jadwal" />
      </div>
    );
  if (status === "dimuat")
    return (
      <div className="stack" style={{ gap: 14 }}>
        <div className="head-actions">
          <Simple id={id} to="berangkat" label="Truk berangkat" className="btn btn-primary" note="Stok keluar dicatat hari ini." />
          <Simple id={id} to="dijadwalkan" label="Batal dimuat (kembali ke jadwal)" className="btn btn-ghost btn-sm" />
        </div>
        <details className="form-details">
          <summary>Langsung tandai terkirim (tanpa status berangkat)</summary>
          <Delivered id={id} label="Konfirmasi barang diterima" optional />
        </details>
        <Delay id={id} />
        {complete}
        <Cancel id={id} label="Batalkan jadwal" />
      </div>
    );
  if (status === "berangkat")
    return (
      <div className="stack" style={{ gap: 14 }}>
        <div className="head-actions"><Simple id={id} to="tiba" label="Sudah tiba di lokasi" className="btn btn-primary" /></div>
        <Delivered id={id} label="Barang sudah sampai?" optional />
        <Delay id={id} />
        <div className="head-actions"><Simple id={id} to="dijadwalkan" label="Batal berangkat (kembali ke jadwal)" className="btn btn-ghost btn-sm" /></div>
        {complete}
        <Cancel id={id} label="Batalkan surat jalan" />
      </div>
    );
  if (status === "tiba")
    return (
      <div className="stack" style={{ gap: 14 }}>
        <Delivered id={id} label="Konfirmasi barang diterima" optional />
        <Delay id={id} />
        <div className="head-actions">
          <Simple id={id} to="berangkat" label="Belum sampai (kembali ke perjalanan)" className="btn btn-ghost btn-sm" />
          <Simple id={id} to="dijadwalkan" label="Batal berangkat (kembali ke jadwal)" className="btn btn-ghost btn-sm" />
        </div>
        {complete}
        <Cancel id={id} label="Batalkan surat jalan" />
      </div>
    );
  if (status === "tertunda")
    return (
      <div className="stack" style={{ gap: 14 }}>
        <div className="head-actions">
          <Simple id={id} to="berangkat" label="Lanjut: truk berangkat" className="btn btn-primary" />
          <Simple id={id} to="tiba" label="Sudah tiba di lokasi" className="btn btn-blue" />
        </div>
        <Delivered id={id} label="Konfirmasi barang diterima" optional />
        <div className="head-actions"><Simple id={id} to="dijadwalkan" label="Kembali ke jadwal" className="btn btn-ghost btn-sm" /></div>
        {complete}
        <Cancel id={id} label="Batalkan surat jalan" />
      </div>
    );
  if (status === "terkirim") return <Cancel id={id} label="Koreksi: batalkan surat jalan yang sudah terkirim" />;
  return <div className="head-actions"><Simple id={id} to="dijadwalkan" label="Jadwalkan ulang" className="btn btn-blue btn-sm" /></div>;
}
