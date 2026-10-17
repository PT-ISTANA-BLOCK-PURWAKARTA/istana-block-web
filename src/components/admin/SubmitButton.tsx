"use client";

import { useContext } from "react";
import { useFormStatus } from "react-dom";
import { PendingContext } from "./ActionForm";

export function SubmitButton({
  children,
  pendingText = "Menyimpan…",
  className = "btn btn-blue",
  name,
  value,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  name?: string;
  value?: string;
}) {
  const ctx = useContext(PendingContext);
  const { pending } = useFormStatus();
  const busy = ctx || pending;
  return (
    <button type="submit" className={className} disabled={busy} aria-busy={busy} name={name} value={value}>
      {busy ? pendingText : children}
    </button>
  );
}
