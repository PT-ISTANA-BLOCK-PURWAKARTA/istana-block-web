"use client";

import { unskipSandTest } from "@/app/operasional/actions/sand";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { whenText } from "@/components/ops/receipts/util";
import type { SkippedReceipt } from "@/lib/ops/sand";
import { fmt } from "@/lib/ops/shared/format";
import { SKIP_LEVEL_LABELS, sourceLabel } from "@/lib/ops/shared/sand";

/** Bahan baku yang uji lumpurnya dilewati (skip): kondisi menurut pengamatan, alasan, siapa; "Batalkan" bila boleh. */
export function SkippedList({ rows, canCancel, title }: { rows: SkippedReceipt[]; canCancel: boolean; title: string }) {
  if (!rows.length) return null;
  return (
    <section className="admin-card sand-skipped">
      <div className="card-head"><h2>{title} <span className="small muted">({rows.length})</span></h2></div>
      <div className="rcv-grid">
        {rows.map((row) => (
          <div key={row.id} className="sand-skip-row">
            <b>{row.itemName}{row.tag ? ` · ${row.tag}` : ""}</b>
            <span className="small muted">
              {[whenText(row.receivedAt), sourceLabel(row) !== "-" ? sourceLabel(row) : null, row.vehiclePlate, row.quantity ? `${fmt(row.quantity)} ${row.unit}` : null].filter(Boolean).join(" · ")}
            </span>
            <span className={`small sand-skip-${row.level ?? "none"}`}><b>{row.level ? SKIP_LEVEL_LABELS[row.level] : "Dilewati"}</b>{row.reason ? ` — ${row.reason}` : ""}</span>
            <span className="small muted">Skip oleh {row.skippedByName ?? "-"} · {whenText(row.skippedAt)}</span>
            {canCancel && <ConfirmAction action={unskipSandTest.bind(null, row.id)} label="Batalkan skip" confirmText={`Kembalikan ${row.itemName} ke daftar yang perlu diuji?`} />}
          </div>
        ))}
      </div>
    </section>
  );
}