"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { uploadDeliveryProof } from "@/app/operasional/actions/deliveries";
import { ProofInput } from "../ProofInput";

/** Unggah satu foto bukti ke surat jalan (maks 4). Dipakai kantor dan sopir (mis. foto saat tiba di lokasi). */
export function ProofUploader({ id, count, max, label = "Tambah foto bukti", help }: { id: string; count: number; max: number; label?: string; help?: string }) {
  if (count >= max) return <p className="small muted">Foto bukti sudah penuh ({count}/{max}).</p>;
  return (
    <ActionForm action={uploadDeliveryProof} className="dl-upload" resetOnOk>
      <input type="hidden" name="id" value={id} />
      <ProofInput id={`up-${id}`} label={label} help={help ?? `${count}/${max} foto`} />
      <SubmitButton className="btn btn-ghost btn-sm" pendingText="Mengunggah…">Unggah foto</SubmitButton>
    </ActionForm>
  );
}
