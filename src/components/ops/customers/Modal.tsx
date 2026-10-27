"use client";

import { useEffect, useRef } from "react";

/** Dialog modal (elemen <dialog> bawaan browser): Esc atau klik latar menutup. */
export function Modal({ title, desc, onClose, children }: { title: string; desc?: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => {
      if (d?.open) d.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="rp-dialog"
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="rp-dialog-in">
        <button type="button" className="btn btn-ghost btn-sm rp-close" onClick={onClose} aria-label="Tutup">✕</button>
        <h2>{title}</h2>
        {desc && <p className="rp-desc">{desc}</p>}
        {children}
      </div>
    </dialog>
  );
}
