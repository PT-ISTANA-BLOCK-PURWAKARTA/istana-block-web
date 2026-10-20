"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { setDeliveryStatus } from "@/app/operasional/actions/deliveries";

/** Tombol besar "Sudah dimuat" di papan muatan (satpam/mandor harus sedang piket; sopir diberi tahu). */
export function LoadButton({ id, to = "dimuat", label = "Sudah dimuat", className = "btn btn-primary btn-block" }: { id: string; to?: "dimuat" | "dijadwalkan"; label?: string; className?: string }) {
  return (
    <ActionForm action={setDeliveryStatus} className="mu-act">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="to" value={to} />
      <input type="hidden" name="back" value="/operasional/muatan" />
      <SubmitButton className={className} pendingText="Mencatat…">{label}</SubmitButton>
    </ActionForm>
  );
}
