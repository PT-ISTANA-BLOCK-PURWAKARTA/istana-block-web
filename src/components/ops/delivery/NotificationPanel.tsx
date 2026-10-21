"use client";

import Link from "next/link";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { markNotificationsRead } from "@/app/operasional/actions/deliveries";

export type NoticeItem = { id: string; kind: string; refId: string; title: string; message: string; when: string };

/** Panel notifikasi di papan muatan ("PO baru perlu diperiksa / menunggu dimuat"), dengan tombol tandai dibaca. */
export function NotificationPanel({ title, items }: { title: string; items: NoticeItem[] }) {
  if (!items.length) return null;
  return (
    <section className="admin-card mu-notices" aria-label={title}>
      <div className="card-head">
        <h2>{title}</h2>
        <ActionForm action={markNotificationsRead} className="inline-form">
          <input type="hidden" name="ids" value={JSON.stringify(items.map((i) => i.id))} />
          <SubmitButton className="btn btn-ghost btn-sm" pendingText="…">Tandai dibaca</SubmitButton>
        </ActionForm>
      </div>
      <ul>
        {items.map((n) => (
          <li key={n.id}>
            <Link href={n.kind === "po_baru" ? `/operasional/pesanan/${n.refId}` : `/operasional/pengiriman/${n.refId}`}><b>{n.title}</b></Link>
            {n.message && <span className="small"> · {n.message}</span>}
            <span className="small muted"> · {n.when}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
