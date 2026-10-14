"use client";

import { useTransition } from "react";

export function DeleteButton({ action, label = "Hapus", confirmText }: { action: () => Promise<void>; label?: string; confirmText: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="link-btn"
      disabled={pending}
      onClick={() => {
        if (window.confirm(confirmText)) start(() => action());
      }}
    >
      {pending ? "Menghapus…" : label}
    </button>
  );
}
