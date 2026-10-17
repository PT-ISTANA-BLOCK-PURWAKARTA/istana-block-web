"use client";

import { useState, useTransition } from "react";
import type { FormState } from "@/components/admin/FormMessage";

/** Tombol aksi berbahaya (hapus/batal) dengan konfirmasi; menampilkan pesan bila ditolak server. */
export function ConfirmAction({ action, label, confirmText, className = "link-btn" }: { action: () => Promise<FormState | void>; label: string; confirmText: string; className?: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="confirm-action">
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => {
          if (!window.confirm(confirmText)) return;
          setErr(null);
          start(async () => {
            const r = await action();
            if (r && r.error) setErr(r.error);
          });
        }}
      >
        {pending ? "Memproses…" : label}
      </button>
      {err && <span className="small text-bahaya" role="alert">{err}</span>}
    </span>
  );
}
