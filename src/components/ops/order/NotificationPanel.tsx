"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { markNotificationsRead } from "@/app/operasional/actions/deliveries";
import { formatDateTime } from "@/lib/ops/shared/format";

export type PanelNotification = { id: string; kind: string; refId: string; title: string; message: string; createdAt: number };

const href = (n: PanelNotification) => (n.kind === "po_baru" ? `/operasional/pesanan/${n.refId}` : n.refId ? `/operasional/pengiriman/${n.refId}` : null);

/** Notifikasi kantor yang belum dibaca (PO baru, sudah dimuat, perubahan status kirim) dengan tombol tandai dibaca. */
export function NotificationPanel({ items }: { items: PanelNotification[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const mark = (ids: string[]) => {
    if (!ids.length) return;
    setErr(null);
    start(async () => {
      const fd = new FormData();
      fd.set("ids", JSON.stringify(ids));
      const r = await markNotificationsRead(undefined, fd);
      if (r?.error) setErr(r.error);
      router.refresh();
    });
  };

  return (
    <section className="admin-card" aria-label="Notifikasi kantor">
      <div className="card-head">
        <h2>Notifikasi{items.length ? ` (${items.length})` : ""}</h2>
        {items.length > 0 && <button type="button" className="linklike" disabled={pending} onClick={() => mark(items.map((n) => n.id))}>{pending ? "Memproses…" : "Tandai semua dibaca"}</button>}
      </div>
      {err && <p className="alert alert-error" role="alert">{err}</p>}
      <table className="compact">
        <tbody>
          {items.map((n) => {
            const to = href(n);
            return (
              <tr key={n.id}>
                <td>
                  {to ? <Link href={to}><b>{n.title}</b></Link> : <b>{n.title}</b>}
                  {n.message && <div className="small muted">{n.message}</div>}
                </td>
                <td className="num small">
                  {formatDateTime(n.createdAt * 1000)}
                  <div><button type="button" className="linklike" disabled={pending} onClick={() => mark([n.id])}>Dibaca</button></div>
                </td>
              </tr>
            );
          })}
          {items.length === 0 && <tr><td className="muted">Tidak ada notifikasi baru.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}
