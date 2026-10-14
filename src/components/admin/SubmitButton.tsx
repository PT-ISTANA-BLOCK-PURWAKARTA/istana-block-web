"use client";

import { useContext } from "react";
import { useFormStatus } from "react-dom";
import { PendingContext } from "./ActionForm";

export function SubmitButton({ children, pendingText = "Menyimpan…", className = "btn btn-blue" }: { children: React.ReactNode; pendingText?: string; className?: string }) {
  const ctx = useContext(PendingContext);
  const { pending } = useFormStatus();
  const busy = ctx || pending;
  return (
    <button type="submit" className={className} disabled={busy} aria-busy={busy}>
      {busy ? pendingText : children}
    </button>
  );
}
