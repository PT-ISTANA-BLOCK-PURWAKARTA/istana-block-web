"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { setDeliveryStatus } from "@/app/operasional/actions/deliveries";
import { DRIVER_STEP_LABEL } from "@/components/ops/delivery/status";
import { ProofUploader } from "@/components/ops/delivery/ProofUploader";
import { ProofInput } from "./ProofInput";

type Step = "dimuat" | "berangkat" | "tiba" | "terkirim";

function StepForm({ id, to, label, hint, primary = true }: { id: string; to: Step; label: string; hint?: string; primary?: boolean }) {
  return (
    <ActionForm action={setDeliveryStatus} className="driver-action">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="to" value={to} />
      {hint && <p className="small muted">{hint}</p>}
      <SubmitButton className={`btn ${primary ? "btn-primary" : "btn-ghost"} btn-block`} pendingText="Mencatat…">{label}</SubmitButton>
    </ActionForm>
  );
}

/**
 * Tombol langkah berikutnya untuk sopir, berurutan: Sudah dimuat → Berangkat → Sudah tiba → Terkirim.
 * `next` dihitung server (driverNext); `resume` = langkah untuk melanjutkan bila kantor mencatat tertunda.
 */
export function DriverActions({
  id,
  next,
  resume,
  proofCount,
  uploadCount,
  maxProofs,
}: {
  id: string;
  next: Step | null;
  resume?: Step | null;
  /** Semua foto bukti yang sudah ada (termasuk foto lama proof_key): menentukan apakah foto wajib saat terkirim. */
  proofCount: number;
  /** Foto di ops_delivery_proofs: dibatasi maxProofs. */
  uploadCount: number;
  maxProofs: number;
}) {
  if (!next) return null;
  return (
    <div className="stack" style={{ gap: 14 }}>
      {resume && <StepForm id={id} to={resume} label={`Lanjutkan: ${DRIVER_STEP_LABEL[resume]}`} hint="Kantor mencatat pengiriman ini tertunda. Tekan setelah Anda kembali berjalan." primary={false} />}
      {next === "dimuat" && <StepForm id={id} to="dimuat" label="Sudah dimuat" hint="Tekan setelah semua barang di atas sudah naik ke truk. Tombol berangkat muncul sesudahnya." />}
      {next === "berangkat" && <StepForm id={id} to="berangkat" label="Berangkat" hint="Tekan saat truk mulai jalan. Lokasi HP dibagikan otomatis ke kantor." />}
      {next === "tiba" && (
        <>
          <StepForm id={id} to="tiba" label="Sudah tiba di lokasi" hint="Tekan saat truk sampai di tujuan." />
          <ProofUploader id={id} count={uploadCount} max={maxProofs} label="Foto saat tiba" help="opsional · barang di lokasi" />
        </>
      )}
      {next === "terkirim" && (
        <ActionForm action={setDeliveryStatus} className="driver-action">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="to" value="terkirim" />
          <h2>Barang sudah diterima?</h2>
          <div className="field">
            <label htmlFor="dr-recv">Nama penerima di lokasi</label>
            <input id="dr-recv" name="receivedBy" required placeholder="mis. Pak Udin (mandor)" autoComplete="off" />
          </div>
          <ProofInput id="dr-proof" required={proofCount === 0} label={proofCount === 0 ? "Foto bukti" : "Foto bukti tambahan"} help={proofCount === 0 ? "surat jalan yang sudah ditandatangani, atau barang di lokasi" : `sudah ada ${proofCount} foto · opsional`} />
          <SubmitButton className="btn btn-primary btn-block" pendingText="Mengunggah…">Tandai terkirim</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
