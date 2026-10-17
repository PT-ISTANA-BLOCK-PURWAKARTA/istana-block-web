"use client";

import { useActionState } from "react";
import { newGpsKey } from "@/app/operasional/actions/tracking";

/** Buat kunci baru penerima GPS lalu tampilkan alamat lengkapnya (sekali saja). */
export function GpsKeyForm({ origin, hint }: { origin: string; hint: string | null }) {
  const [state, action, pending] = useActionState(newGpsKey, undefined);
  const key = state && "key" in state ? state.key : undefined;
  return (
    <form
      action={action}
      className="stack"
      style={{ gap: 12 }}
      onSubmit={(e) => {
        if (hint && !confirm("Kunci lama langsung tidak berlaku. Semua alat & HP yang memakai kunci lama harus diisi ulang. Lanjutkan?")) e.preventDefault();
      }}
    >
      <p className="small">
        {hint ? <>Kunci aktif berakhiran <code>…{hint}</code>. Kunci lengkap hanya ditampilkan sekali saat dibuat.</> : <>Belum ada kunci. Buat kunci dulu agar alat GPS bisa mengirim posisi.</>}
      </p>
      {key && (
        <div className="gps-urls" role="status">
          <p className="alert alert-ok">{state?.ok}</p>
          <label className="small" htmlFor="gps-url1">Alamat server (OsmAnd / Traccar Client / alat GPS)</label>
          <input id="gps-url1" readOnly value={`${origin}/api/lacak/gps?key=${key}`} onFocus={(e) => e.currentTarget.select()} />
          <label className="small" htmlFor="gps-url2">Alternatif tanpa tanda tanya (untuk alat yang tidak menerima ?…)</label>
          <input id="gps-url2" readOnly value={`${origin}/api/lacak/gps/${key}`} onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}
      {state?.error && <p className="alert alert-error">{state.error}</p>}
      <div>
        <button type="submit" className={`btn ${hint ? "btn-ghost" : "btn-primary"} btn-sm`} disabled={pending}>
          {pending ? "Membuat…" : hint ? "Buat kunci baru (ganti yang lama)" : "Buat kunci"}
        </button>
      </div>
    </form>
  );
}
