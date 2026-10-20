"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { PendingContext } from "@/components/admin/ActionForm";
import { FormMessage, type FormState } from "@/components/admin/FormMessage";

/** Dialog bawaan browser (<dialog>): tutup dengan Esc, klik di luar kotak, atau tombol ×. */
export function Modal({ title, sub, onClose, children }: { title: string; sub?: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog ref={ref} className="rcv-modal" onClose={onClose} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
      <div className="rcv-modal-body">
        <div className="card-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Tutup" style={{ color: "var(--p-muted)" }} onClick={() => ref.current?.close()}>×</button>
        </div>
        {sub && <p className="small muted" style={{ marginTop: -4 }}>{sub}</p>}
        {children}
      </div>
    </dialog>
  );
}

/**
 * Form di dalam dialog: menjalankan server action, menampilkan pesan, lalu memanggil `onSaved` (menutup dialog)
 * bila aksi mengembalikan { ok }. Isian dikendalikan induknya (state), jadi tidak hilang saat error.
 */
export function DialogForm({ action, onSaved, children }: { action: (prev: FormState, form: FormData) => Promise<FormState>; onSaved: () => void; children: React.ReactNode }) {
  const [state, dispatch, pending] = useActionState(action, undefined);
  const [, startTransition] = useTransition();
  const saved = useRef(onSaved);
  saved.current = onSaved;
  useEffect(() => {
    if (state?.ok) saved.current();
  }, [state]);
  return (
    <form
      className="stack"
      style={{ gap: 16 }}
      action={dispatch}
      // Seperti ActionForm: kirim lewat transition supaya React 19 tidak mengosongkan isian (termasuk foto) saat error.
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => dispatch(new FormData(e.currentTarget)));
      }}
    >
      <PendingContext.Provider value={pending}>
        <FormMessage state={state} />
        {children}
      </PendingContext.Provider>
    </form>
  );
}
