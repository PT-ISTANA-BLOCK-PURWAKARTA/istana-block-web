"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { setDeliveryStatus } from "@/app/operasional/actions/deliveries";

/** Tombol besar "Sudah dimuat" di papan muatan (satpam/mandor harus sedang piket; sopir diberi tahu). */
export function LoadButton({ id, to = "dimuat", label = "Sudah dimuat", className = "btn btn-primary btn-block", back = "/operasional/muatan" }: { id: string; to?: "dimuat" | "dijadwalkan" | "berangkat"; label?: string; className?: string; back?: string }) {
  return (
    <ActionForm action={setDeliveryStatus} className="mu-act">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="to" value={to} />
      <input type="hidden" name="back" value={back} />
      <SubmitButton className={className} pendingText="Mencatat…">{label}</SubmitButton>
    </ActionForm>
  );
}
