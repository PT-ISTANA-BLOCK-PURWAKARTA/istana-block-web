"use client";

// Tombol yang menjalankan server action lalu menampilkan pesan berhasil/gagal (opsional konfirmasi dulu).
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ActionButton({ action, label, confirmText, className = "btn btn-primary btn-sm" }: { action: () => Promise<{ ok?: string; error?: string } | void>; label: string; confirmText?: string; className?: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const router = useRouter();
  return (
    <span className="action-btn">
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => {
          if (confirmText && !window.confirm(confirmText)) return;
          setMsg(null);
          start(async () => {
            const r = await action();
            if (r) setMsg(r);
            router.refresh();
          });
        }}
      >
        {pending ? "Memproses…" : label}
      </button>
      {msg?.error && <span className="small text-bahaya" role="alert">{msg.error}</span>}
      {msg?.ok && <span className="small text-ok" role="status">{msg.ok}</span>}
    </span>
  );
}
