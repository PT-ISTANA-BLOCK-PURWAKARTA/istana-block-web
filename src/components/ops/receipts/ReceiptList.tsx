"use client";

import Link from "next/link";
import { useState } from "react";
import { deleteReceipt } from "@/app/operasional/actions/receipts";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { Icon } from "@/components/panel/Icon";
import { downloadWorkbook } from "@/lib/ops/excel";
import type { ReceiptRow } from "@/lib/ops/receipts";
import { fmt } from "@/lib/ops/shared/format";
import { DELIVERY_MODE_LABELS, PRICE_LABELS, SKIP_LEVEL_LABELS, SPEED_LABELS, siltLevel, sourceLabel } from "@/lib/ops/shared/sand";
import { gradeOf } from "@/lib/ops/shared/score";
import { DeliveryDialog, OverallBadge, PriceChip, PriceDialog, SpeedChip, receiptOverall } from "./ReceiptRatings";
import { CATEGORY_LABELS, berkasUrl, itemSummary, quantitySum, whenText } from "./util";

/** Baris daftar + izin per baris yang dihitung server (hapus bergantung pada pembuat & umur data). */
export type ReceiptCardRow = ReceiptRow & { canDelete: boolean };

const LEVEL_CLASS = { bagus: "ok", cukup: "warn", lewat: "bad" } as const;

function officerText(row: ReceiptRow) {
  return row.createdByName ?? "-";
}

function ReceiptCard({ row, canTest, onRateDelivery, onRatePrice }: { row: ReceiptCardRow; canTest: boolean; onRateDelivery?: () => void; onRatePrice?: () => void }) {
  const silt = row.siltPercent;
  const score = receiptOverall(row);
  const raw = row.category === "bahan_baku";
  const who = [sourceLabel(row) !== "-" ? sourceLabel(row) : null, row.vehiclePlate, row.driverName, row.deliveryNoteNo ? `SJ ${row.deliveryNoteNo}` : null].filter(Boolean).join(" · ");
  return (
    <article className="rcv-card">
      <div className="rcv-top">
        <div className="rcv-title">
          <b>{row.itemName}</b> <span className="rcv-qty-text">· {fmt(row.quantity)} {row.unit}</span>
          <div className="small muted">{whenText(row.receivedAt)} · {CATEGORY_LABELS[row.category]}{row.tag ? ` · ${row.tag}` : ""}</div>
        </div>
        <span className={`badge ${row.status === "ditolak" ? "badge-danger" : "badge-on"}`}>{row.status === "ditolak" ? "Ditolak" : "Diterima"}</span>
      </div>
      <p className="small">{who || "-"}</p>
      {row.deliveryMode && (
        <p className="small muted">
          {row.deliveryMode === "ekspedisi" ? `${row.expeditionName ?? "Ekspedisi"} (ekspedisi)` : DELIVERY_MODE_LABELS[row.deliveryMode]}
        </p>
      )}
      {raw && (
        <p className="small">
          {row.test ? (
            row.test.status === "draft" ? (
              <b className="text-warn">⏳ Uji lumpur sedang mengendap</b>
            ) : (
              silt !== null && <b className={`silt-${LEVEL_CLASS[siltLevel(silt, row.test.maxSiltPercent)]}`}>Kadar lumpur {fmt(silt)}%</b>
            )
          ) : row.testSkippedAt ? (
            <span className="muted">
              Tanpa uji lumpur{row.testSkipLevel ? ` — ${SKIP_LEVEL_LABELS[row.testSkipLevel]}` : ""}{row.testSkipReason ? ` — ${row.testSkipReason}` : ""}
              {row.testSkippedByName ? ` (skip oleh ${row.testSkippedByName})` : ""}
            </span>
          ) : (
            <span className="muted">Belum diuji lumpur</span>
          )}
          {row.hasBrangkal ? <span className="muted"> · banyak brangkal</span> : null}
        </p>
      )}
      {row.photoKeys.length > 0 && (
        <div className="rcv-photos">
          {row.photoKeys.map((key) => (
            <a key={key} href={berkasUrl(key)} target="_blank" rel="noreferrer" className="rcv-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={berkasUrl(key)} alt="Foto barang" loading="lazy" />
            </a>
          ))}
        </div>
      )}
      {row.notes && <p className="small">{row.notes}</p>}
      {(row.speedRating || row.priceRating || row.tier) && (
        <div className="rcv-chips">
          <SpeedChip value={row.deliveryMode === "sendiri" ? null : row.speedRating} />
          <PriceChip value={row.priceRating} />
          <OverallBadge score={score.overall} complete={score.complete} />
        </div>
      )}
      {(row.deliveryNote || row.priceNote) && (
        <p className="small muted">
          {row.deliveryNote ? `Pengiriman: “${row.deliveryNote}” ` : ""}
          {row.priceNote ? `Harga: “${row.priceNote}”` : ""}
        </p>
      )}
      {(onRateDelivery || onRatePrice || (raw && canTest)) && (
        <div className="rcv-actions">
          {onRateDelivery && (
            <button type="button" className={`btn btn-sm ${row.speedRating ? "btn-ghost" : "btn-blue"}`} onClick={onRateDelivery}>
              {row.speedRating ? "Ubah nilai kirim" : "Nilai pengiriman"}
            </button>
          )}
          {onRatePrice && (
            <button type="button" className={`btn btn-sm ${row.priceRating ? "btn-ghost" : "btn-blue"}`} onClick={onRatePrice}>
              {row.priceRating ? "Ubah harga" : "Nilai harga"}
            </button>
          )}
          {raw && canTest && (
            <Link href={`/operasional/uji-pasir?barang=${row.id}`} className="btn btn-ghost btn-sm" title="Mulai uji lumpur untuk barang ini" aria-label="Mulai uji lumpur untuk barang ini">
              <Icon name="sand" size={16} /> Uji lumpur
            </Link>
          )}
        </div>
      )}
      <div className="rcv-foot">
        <span className="small muted">Dicatat {officerText(row)}</span>
        {row.canDelete && <ConfirmAction action={deleteReceipt.bind(null, row.id)} label="Hapus" confirmText={`Hapus data ${row.itemName} ${fmt(row.quantity)} ${row.unit}?`} />}
      </div>
    </article>
  );
}

async function exportExcel(rows: ReceiptRow[], from: string, to: string) {
  const accepted = rows.filter((row) => row.status === "diterima");
  const origin = window.location.origin;
  await downloadWorkbook(`Barang-Masuk_${from}_sd_${to}.xlsx`, [
    {
      name: "Rekap per barang",
      title: `BARANG MASUK ${from} s/d ${to} — rekap per barang (yang diterima)`,
      columns: [
        { key: "no", header: "No", width: 6 },
        { key: "jenis", header: "Jenis", width: 14 },
        { key: "barang", header: "Barang", width: 28 },
        { key: "kiriman", header: "Kiriman", width: 10 },
        { key: "jumlah", header: "Jumlah diterima", width: 24 },
        { key: "terakhir", header: "Terakhir datang", width: 20 },
      ],
      rows: itemSummary(accepted).map((s, i) => ({ no: i + 1, jenis: CATEGORY_LABELS[s.category], barang: s.item, kiriman: s.count, jumlah: quantitySum(s.rows), terakhir: s.last })),
    },
    {
      name: "Detail barang masuk",
      title: `BARANG MASUK ${from} s/d ${to} — detail`,
      columns: [
        ["no", "No"], ["tanggal", "Tanggal"], ["jenis", "Jenis"], ["barang", "Barang"], ["tag", "Tag"], ["jumlah", "Jumlah"], ["satuan", "Satuan"], ["status", "Status"],
        ["supplier", "Supplier"], ["quarry", "Quarry"], ["plat", "Plat truk"], ["sopir", "Sopir"], ["sj", "No. surat jalan"], ["pengirim", "Dikirim oleh"], ["ekspedisi", "Ekspedisi"],
        ["kecepatan", "Kecepatan"], ["ketKirim", "Keterangan pengiriman"], ["harga", "Harga"], ["ketHarga", "Keterangan harga"], ["overall", "Nilai overall"], ["grade", "Grade"],
        ["lumpur", "Kadar lumpur (%)"], ["brangkal", "Brangkal"], ["catatan", "Catatan"], ["pencatat", "Dicatat oleh"], ["foto", "Foto"],
      ].map(([key, header]) => ({ key, header })),
      rows: rows.map((row, i) => {
        const score = receiptOverall(row).overall;
        return {
          no: i + 1, tanggal: new Date(row.receivedAt), jenis: CATEGORY_LABELS[row.category], barang: row.itemName, tag: row.tag ?? "", jumlah: row.quantity, satuan: row.unit,
          status: row.status === "ditolak" ? "Ditolak" : "Diterima", supplier: row.supplier ?? "", quarry: row.quarry ?? "", plat: row.vehiclePlate ?? "", sopir: row.driverName ?? "", sj: row.deliveryNoteNo ?? "",
          pengirim: row.deliveryMode ? DELIVERY_MODE_LABELS[row.deliveryMode] : "", ekspedisi: row.expeditionName ?? "", kecepatan: row.speedRating ? SPEED_LABELS[row.speedRating] : "",
          ketKirim: row.deliveryNote ?? "", harga: row.priceRating ? PRICE_LABELS[row.priceRating] : "", ketHarga: row.priceNote ?? "", overall: score ?? "", grade: score === null ? "" : gradeOf(score)!.grade,
          lumpur: row.siltPercent ?? "", brangkal: row.hasBrangkal ? "Banyak" : "", catatan: row.notes, pencatat: officerText(row), foto: row.photoKeys.map((key) => `${origin}${berkasUrl(key)}`).join(" "),
        };
      }),
    },
  ]);
}

/** Daftar kartu barang masuk + tombol Excel + dialog penilaian pengiriman / harga sesuai izin. */
export function ReceiptList({
  rows,
  from,
  to,
  canRateDelivery,
  canRatePrice,
  canTest,
  showExcel,
  expeditions,
  tags,
}: {
  rows: ReceiptCardRow[];
  from: string;
  to: string;
  canRateDelivery: boolean;
  canRatePrice: boolean;
  canTest: boolean;
  showExcel: boolean;
  expeditions: string[];
  tags: string[];
}) {
  const [rating, setRating] = useState<{ row: ReceiptCardRow; kind: "delivery" | "price" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const accepted = rows.filter((row) => row.status === "diterima");
  const summary = itemSummary(accepted);
  // Setelah revalidasi, baris dialog diganti dengan data terbaru agar nilai awal form ikut segar.
  const subject = rating ? rows.find((row) => row.id === rating.row.id) ?? rating.row : null;
  return (
    <>
      {showExcel && summary.length > 0 && (
        <div className="admin-card rcv-summary">
          <div className="card-head"><h2>Rekap barang diterima</h2></div>
          <div className="rcv-chips">
            {summary.map((s) => (
              <span key={`${s.category}-${s.item}`} className="rcv-sum-chip"><b>{s.item}</b> {quantitySum(s.rows)} · {s.count} kiriman</span>
            ))}
          </div>
        </div>
      )}
      {showExcel && (
        <div className="rcv-toolbar">
          <button type="button" className="btn btn-ghost btn-sm" disabled={!rows.length} onClick={() => { setError(null); void exportExcel(rows, from, to).catch((e) => setError(e instanceof Error ? e.message : "Gagal membuat Excel")); }}>
            Unduh Excel
          </button>
          {error && <span className="small text-bahaya" role="alert">{error}</span>}
        </div>
      )}
      {rows.length === 0 ? (
        <div className="admin-card"><p className="muted">Belum ada barang masuk pada periode ini.</p></div>
      ) : (
        <div className="rcv-grid">
          {rows.map((row) => (
            <ReceiptCard key={row.id} row={row} canTest={canTest} onRateDelivery={canRateDelivery ? () => setRating({ row, kind: "delivery" }) : undefined} onRatePrice={canRatePrice ? () => setRating({ row, kind: "price" }) : undefined} />
          ))}
        </div>
      )}
      {subject && rating?.kind === "delivery" && <DeliveryDialog row={subject} expeditions={expeditions} tags={tags} onClose={() => setRating(null)} />}
      {subject && rating?.kind === "price" && <PriceDialog row={subject} onClose={() => setRating(null)} />}
    </>
  );
}
