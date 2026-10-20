"use client";

import { useState } from "react";
import { startSandTest } from "@/app/operasional/actions/sand";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Chips } from "@/components/ops/receipts/Chips";
import { PhotoPicker } from "@/components/ops/receipts/PhotoPicker";
import { whenText } from "@/components/ops/receipts/util";
import type { ReadingUnit } from "@/db/erp";
import type { ReceiptForTesting } from "@/lib/ops/receipts";
import { fmt } from "@/lib/ops/shared/format";
import { GOOD_SILT_PERCENT, MATERIALS, MAX_SILT_PERCENT, sourceLabel } from "@/lib/ops/shared/sand";
import { ReadingFields, emptyReading } from "./ReadingFields";
import { UNIT_LABELS } from "./util";

const UNITS = ["ml", "cm"] as const;

/** Mulai uji lumpur: pilih barang masuk (3 hari terakhir) atau manual, foto awal → draft; atau langsung isi hasil. */
export function StartForm({ receipts, preselect, nowLocal }: { receipts: ReceiptForTesting[]; preselect: string | null; nowLocal: string }) {
  const [target, setTarget] = useState<string>(preselect ?? "");
  const [material, setMaterial] = useState<string>(MATERIALS[0]);
  const [unit, setUnit] = useState<ReadingUnit>("ml");
  const [now, setNow] = useState(false);
  const [reading, setReading] = useState(emptyReading);
  // Barang yang sudah selesai diuji disembunyikan, kecuali yang dipilih lewat tautan (?barang=…).
  const untested = receipts.filter((receipt) => receipt.testStatus !== "selesai" || receipt.id === preselect);

  return (
    <ActionForm action={startSandTest} className="form-section rcv-form">
      <div>
        <h2>Mulai uji lumpur</h2>
        <details className="sand-how">
          <summary>Cara uji (gelas ukur / botol)</summary>
          <ol>
            <li>Isi gelas ukur (atau botol bening) ± 1/3 dengan sampel dari truk — ambil dari beberapa titik.</li>
            <li>Tambahkan air sampai ± 2/3, beri sejumput garam, kocok kuat 1 menit. <b>Foto gelas/botol</b>, lalu simpan sebagai <b>draft</b>.</li>
            <li>Diamkan minimal 1 jam (lebih baik 3 jam) di tempat rata.</li>
            <li>Buka draft → <b>Isi hasil</b>: baca skala batas atas pasir &amp; lumpur (gelas ukur) atau ukur tebal endapan (botol), lalu <b>foto lagi</b>.</li>
            <li>Kadar lumpur dihitung otomatis: <b>≤ {GOOD_SILT_PERCENT}% bagus</b>, maksimal {MAX_SILT_PERCENT}%.</li>
          </ol>
        </details>
      </div>

      <input type="hidden" name="receiptId" value={target} />
      <div className="field">
        <span className="label">Barang yang diuji</span>
        {untested.length ? (
          <div className="sand-pick">
            {untested.map((receipt) => (
              <button key={receipt.id} type="button" aria-pressed={target === receipt.id} className={`sand-pick-btn${target === receipt.id ? " on" : ""}`} onClick={() => setTarget(receipt.id)}>
                <b>{receipt.itemName}{receipt.tag ? ` · ${receipt.tag}` : ""}</b>
                <span className="small">
                  {whenText(receipt.receivedAt)} · {sourceLabel(receipt)}
                  {receipt.vehiclePlate ? ` · ${receipt.vehiclePlate}` : ""}
                  {receipt.quantity ? ` · ${fmt(receipt.quantity)} ${receipt.unit}` : ""}
                </span>
                {receipt.testStatus === "draft" && <span className="small text-warn">sudah ada draft uji</span>}
              </button>
            ))}
          </div>
        ) : (
          <p className="flag flag-info">Belum ada bahan baku masuk 3 hari terakhir yang belum diuji. Catat dulu di menu Barang masuk, atau pilih &quot;Tanpa data barang masuk&quot;.</p>
        )}
        <button type="button" aria-pressed={target === "manual"} className={`sand-pick-btn sand-pick-manual${target === "manual" ? " on" : ""}`} onClick={() => setTarget("manual")}>
          Tanpa data barang masuk (mis. QC menguji stok abu batu / screening)
        </button>
        {target === "manual" && (
          <div className="sand-manual">
            <Chips name="sandType" value={material} options={MATERIALS} onChange={setMaterial} label="Jenis material" />
            <div className="form-grid">
              <input name="supplier" maxLength={80} placeholder="Supplier (opsional)" aria-label="Supplier" autoComplete="off" />
              <input name="quarry" maxLength={80} placeholder="Quarry (opsional)" aria-label="Quarry" autoComplete="off" />
            </div>
          </div>
        )}
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="sd-at">Waktu sampel diambil</label>
          <input id="sd-at" name="testedAt" type="datetime-local" required defaultValue={nowLocal} />
        </div>
        <div className="field">
          <span className="label">Alat ukur</span>
          <Chips name="readingUnit" value={unit} options={UNITS} labels={UNIT_LABELS} onChange={setUnit} label="Alat ukur" />
        </div>
      </div>

      <div className="field">
        <span className="label">Foto gelas / botol setelah diisi &amp; dikocok</span>
        <PhotoPicker name="startPhoto" label="Foto gelas / botol" />
      </div>

      <div className="field">
        <label htmlFor="sd-notes">Catatan</label>
        <textarea id="sd-notes" name="notes" maxLength={1000} placeholder="Warna, gumpalan tanah, sampah, kerikil, dll." />
      </div>

      <label className="check">
        <input type="checkbox" name="now" value="1" checked={now} onChange={(e) => setNow(e.target.checked)} />
        Sampel sudah mengendap — isi hasilnya sekarang
      </label>
      {now && <ReadingFields unit={unit} value={reading} onChange={setReading} />}

      <div className="form-actions">
        <SubmitButton className="btn btn-primary btn-block rcv-save" pendingText="Menyimpan…">{now ? "Simpan hasil uji" : "Simpan draft — mulai mengendap"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
