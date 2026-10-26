"use client";

// Penilaian barang masuk: kecepatan & keterangan pengiriman (kantor), harga (pimpinan), dan nilai overall.
import { useState } from "react";
import { rateDelivery, ratePrice } from "@/app/operasional/actions/receipts";
import { SubmitButton } from "@/components/admin/SubmitButton";
import type { DeliveryMode, ReceiptCategory } from "@/db/erp";
import { fmt } from "@/lib/ops/shared/format";
import { OTHER_UNITS, RAW_UNITS } from "@/lib/ops/shared/goods";
import { DELIVERY_MODES, DELIVERY_MODE_LABELS, PRICE_LABELS, SPEED_LABELS, sourceLabel, type SandTier } from "@/lib/ops/shared/sand";
import { gradeOf, overallScore, receiptParts } from "@/lib/ops/shared/score";
import { Chips } from "./Chips";
import { DialogForm, Modal } from "./Modal";
import { whenFull } from "./util";

/** Bagian barang masuk yang dibutuhkan untuk menghitung nilai overall. */
export type Rated = { category: ReceiptCategory; tier: SandTier | null; speedRating: number | null; priceRating: number | null; deliveryMode?: DeliveryMode | null };

/** Bagian barang masuk yang dibutuhkan dialog penilaian. */
export type RatingSubject = Rated & {
  id: string;
  itemName: string;
  supplier: string | null;
  quarry: string | null;
  receivedAt: Date | string;
  vehiclePlate: string | null;
  quantity: number | null;
  unit: string;
  tag: string | null;
  deliveryMode: DeliveryMode | null;
  expeditionName: string | null;
  deliveryNote: string | null;
  priceNote: string | null;
};

/** Nilai overall satu kiriman (tier hanya dihitung untuk bahan baku). */
export const receiptOverall = (row: Rated) =>
  // Armada Istana Block sendiri ("sendiri") bukan kinerja supplier: kecepatannya tidak ikut menilai.
  overallScore(receiptParts({ tier: row.category === "bahan_baku" ? row.tier : null, speedRating: row.deliveryMode === "sendiri" ? null : row.speedRating, priceRating: row.priceRating }));

/** Label tiga tingkat; untuk rata-rata ditampilkan juga angkanya (mis. "Standard · 2,3/3"). */
export function LevelChip({ value, labels, empty = "belum dinilai" }: { value: number | null; labels: Record<number, string>; empty?: string }) {
  if (value === null) return <span className="small muted">{empty}</span>;
  const level = Math.min(3, Math.max(1, Math.round(value)));
  return (
    <span className={`lv lv-${level}`}>
      {labels[level]}
      {Number.isInteger(value) ? "" : <span className="lv-avg">· {fmt(value, 1)}/3</span>}
    </span>
  );
}
export const SpeedChip = ({ value }: { value: number | null }) => <LevelChip value={value} labels={SPEED_LABELS} />;
export const PriceChip = ({ value }: { value: number | null }) => <LevelChip value={value} labels={PRICE_LABELS} empty="harga belum dinilai" />;

/** Nilai overall 0–100 + grade A–D; "sementara" bila belum ketiga komponen dinilai. */
export function OverallBadge({ score, complete }: { score: number | null; complete: boolean }) {
  const grade = gradeOf(score);
  if (!grade || score === null) return <span className="small muted">Overall belum ada</span>;
  return (
    <span className="overall" title={complete ? "Kualitas, kecepatan, dan harga sudah dinilai" : "Belum semua komponen dinilai"}>
      Overall {score} · {grade.grade}
      {complete ? "" : <span className="overall-tmp">(sementara)</span>}
    </span>
  );
}

function ThreeLevelPicker({ name, value, labels, onChange }: { name: string; value: number; labels: Record<number, string>; onChange: (value: number) => void }) {
  return (
    <div className="lv-pick">
      <input type="hidden" name={name} value={value || ""} />
      {[1, 2, 3].map((level) => (
        <button key={level} type="button" aria-pressed={value === level} className={`lv-pick-btn lv-${level}${value === level ? " on" : ""}`} onClick={() => onChange(value === level ? 0 : level)}>
          {labels[level]}
        </button>
      ))}
    </div>
  );
}

const subjectText = (row: RatingSubject) => `${row.itemName} · ${sourceLabel(row)} · ${whenFull(row.receivedAt)}`;

/** Kantor: pengirim, kecepatan (Lambat / Standard / Cepat), keterangan; boleh merapikan tag & jumlah. */
export function DeliveryDialog({ row, expeditions, tags, onClose }: { row: RatingSubject; expeditions: string[]; tags: string[]; onClose: () => void }) {
  const [form, setForm] = useState({
    deliveryMode: (row.deliveryMode ?? "") as DeliveryMode | "",
    expeditionName: row.expeditionName ?? "",
    speedRating: row.speedRating ?? 0,
    deliveryNote: row.deliveryNote ?? "",
    tag: row.tag ?? "",
    quantity: row.quantity ? String(row.quantity).replace(".", ",") : "",
    unit: row.unit,
  });
  const units = [...new Set([...(row.category === "bahan_baku" ? RAW_UNITS : OTHER_UNITS), form.unit])];
  return (
    <Modal title="Nilai pengiriman (kantor)" sub={`${subjectText(row)} · ${row.vehiclePlate ?? "tanpa plat"}`} onClose={onClose}>
      <DialogForm action={rateDelivery} onSaved={onClose}>
        <input type="hidden" name="id" value={row.id} />
        <div className="form-grid">
          <div className="field">
            <label htmlFor="rd-tag">Tag (inventory)</label>
            <input id="rd-tag" name="tag" list="rd-tags" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} placeholder="mis. Pasir Cimalaka" />
            <datalist id="rd-tags">{tags.map((value) => <option key={value} value={value} />)}</datalist>
          </div>
          <div className="field">
            <label htmlFor="rd-qty">Jumlah</label>
            <div className="inline-form">
              <input id="rd-qty" name="quantity" className="num" inputMode="decimal" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              <select name="unit" aria-label="Satuan" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="field">
          <span className="label">Dikirim oleh</span>
          <Chips name="deliveryMode" value={form.deliveryMode} options={DELIVERY_MODES} labels={DELIVERY_MODE_LABELS} onChange={(deliveryMode) => setForm({ ...form, deliveryMode })} label="Dikirim oleh" />
          {form.deliveryMode === "ekspedisi" && (
            <>
              <input name="expeditionName" list="rd-expeditions" value={form.expeditionName} onChange={(e) => setForm({ ...form, expeditionName: e.target.value })} placeholder="Nama ekspedisi" aria-label="Nama ekspedisi" />
              <datalist id="rd-expeditions">{expeditions.map((value) => <option key={value} value={value} />)}</datalist>
            </>
          )}
        </div>
        {form.deliveryMode === "sendiri" ? (
          <p className="help small muted">Diambil armada Istana Block sendiri: kecepatan tidak dinilai dan tidak ikut nilai overall supplier.</p>
        ) : (
          <div className="field">
            <span className="label">Kecepatan pengiriman</span>
            <ThreeLevelPicker name="speedRating" value={form.speedRating} labels={SPEED_LABELS} onChange={(speedRating) => setForm({ ...form, speedRating })} />
            <span className="help small muted">Boleh dikosongkan bila belum tahu; klik lagi untuk membatalkan pilihan.</span>
          </div>
        )}
        <div className="field">
          <label htmlFor="rd-note">Keterangan pengiriman</label>
          <textarea id="rd-note" name="deliveryNote" value={form.deliveryNote} onChange={(e) => setForm({ ...form, deliveryNote: e.target.value })} placeholder="Contoh: telat 1 hari, sopir tidak bisa dihubungi, muatan kurang." />
        </div>
        <div><SubmitButton className="btn btn-primary">Simpan penilaian pengiriman</SubmitButton></div>
      </DialogForm>
    </Modal>
  );
}

/** Pimpinan: harga Mahal / Sedang / Affordable + keterangan harga. */
export function PriceDialog({ row, onClose }: { row: RatingSubject; onClose: () => void }) {
  const [form, setForm] = useState({ priceRating: row.priceRating ?? 0, priceNote: row.priceNote ?? "" });
  return (
    <Modal title="Nilai harga" sub={`${subjectText(row)}${row.quantity ? ` · ${fmt(row.quantity)} ${row.unit}` : ""}`} onClose={onClose}>
      <DialogForm action={ratePrice} onSaved={onClose}>
        <input type="hidden" name="id" value={row.id} />
        <div className="field">
          <span className="label">Harga</span>
          <ThreeLevelPicker name="priceRating" value={form.priceRating} labels={PRICE_LABELS} onChange={(priceRating) => setForm({ ...form, priceRating })} />
        </div>
        <div className="field">
          <label htmlFor="rp-note">Keterangan harga (opsional)</label>
          <textarea id="rp-note" name="priceNote" value={form.priceNote} onChange={(e) => setForm({ ...form, priceNote: e.target.value })} placeholder="Contoh: Rp 280.000/m³, naik dari bulan lalu, ada diskon langganan." />
        </div>
        <div><SubmitButton className="btn btn-primary">Simpan penilaian harga</SubmitButton></div>
      </DialogForm>
    </Modal>
  );
}
