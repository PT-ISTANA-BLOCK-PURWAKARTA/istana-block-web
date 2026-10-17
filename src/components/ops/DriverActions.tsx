"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { setDeliveryStatus } from "@/app/operasional/actions/deliveries";
import { ProofInput } from "./ProofInput";

/** Tombol sopir: berangkat, lalu terkirim dengan nama penerima & foto bukti. */
export function DriverActions({ id, status }: { id: string; status: string }) {
  if (status === "dijadwalkan")
    return (
      <ActionForm action={setDeliveryStatus} className="driver-action">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="to" value="berangkat" />
        <p className="small muted">Tekan setelah semua barang di atas sudah naik ke truk dan Anda mulai jalan.</p>
        <SubmitButton className="btn btn-primary btn-block" pendingText="Mencatat…">Barang sudah dimuat, saya berangkat</SubmitButton>
      </ActionForm>
    );
  if (status === "berangkat")
    return (
      <ActionForm action={setDeliveryStatus} className="driver-action">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="to" value="terkirim" />
        <h2>Barang sudah sampai?</h2>
        <div className="field">
          <label htmlFor="dr-recv">Nama penerima di lokasi</label>
          <input id="dr-recv" name="receivedBy" required placeholder="mis. Pak Udin (mandor)" autoComplete="off" />
        </div>
        <ProofInput id="dr-proof" required label="Foto bukti" help="surat jalan yang sudah ditandatangani, atau barang di lokasi" />
        <SubmitButton className="btn btn-primary btn-block" pendingText="Mengunggah…">Tandai terkirim</SubmitButton>
      </ActionForm>
    );
  return null;
}
