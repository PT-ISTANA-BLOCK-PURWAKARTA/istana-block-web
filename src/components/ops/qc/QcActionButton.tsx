"use client";

import { useState, useTransition } from "react";
import type { FormState } from "@/components/admin/FormMessage";
import "./qc.css";

/**
 * Tombol aksi baris QC (ACC, revisi, setujui, hapus, TTD, ...). Menanyakan konfirmasi atau catatan lebih dulu,
 * menjalankan server action, lalu menampilkan hasilnya di dekat tombol. Halaman dimuat ulang oleh server action.
 */
export function QcActionButton({
  action,
  label,
  confirmText,
  promptText,
  promptRequired = false,
  promptMin = 3,
  className = "btn btn-ghost btn-sm",
  pendingText = "Memproses…",
}: {
  action: (note?: string) => Promise<FormState | void>;
  label: React.ReactNode;
  /** Pertanyaan ya/tidak sebelum menjalankan. */
  confirmText?: string;
  /** Pertanyaan dengan isian catatan (window.prompt); isiannya diteruskan ke action. */
  promptText?: string;
  promptRequired?: boolean;
  promptMin?: number;
  className?: string;
  pendingText?: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<FormState>(undefined);

  function run() {
    let note: string | undefined;
    if (promptText) {
      const v = window.prompt(promptText);
      if (v === null) return;
      note = v.trim();
      if (promptRequired && note.length < promptMin) {
        setMsg({ error: `Isi minimal ${promptMin} huruf.` });
        return;
      }
    } else if (confirmText && !window.confirm(confirmText)) {
      return;
    }
    setMsg(undefined);
    start(async () => {
      const r = await action(note || undefined);
      setMsg(r ?? undefined);
    });
  }

  return (
    <span className="qc-act">
      <button type="button" className={className} disabled={pending} aria-busy={pending} onClick={run}>
        {pending ? pendingText : label}
      </button>
      {msg?.error && <span className="small text-bahaya" role="alert">{msg.error}</span>}
      {msg?.ok && <span className="small text-sukses" role="status">{msg.ok}</span>}
    </span>
  );
}
