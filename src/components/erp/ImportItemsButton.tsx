"use client";

import { useActionState } from "react";
import { importItemsFromProducts } from "@/app/keuangan/actions/master";

export function ImportItemsButton() {
  const [state, run, pending] = useActionState(importItemsFromProducts, undefined);
  return (
    <form action={run} className="inline-form">
      <button type="submit" className="btn btn-ghost btn-sm" disabled={pending}>{pending ? "Memproses…" : "Ambil dari daftar harga website"}</button>
      {state?.ok && <span className="small text-sukses" role="status">{state.ok}</span>}
      {state?.error && <span className="small text-bahaya" role="alert">{state.error}</span>}
    </form>
  );
}
