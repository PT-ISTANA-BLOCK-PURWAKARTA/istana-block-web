"use client";

import { useState } from "react";
import { createReceipt } from "@/app/operasional/actions/receipts";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import type { DeliveryMode, ReceiptCategory, ReceiptStatus } from "@/db/erp";
import type { ReceiptSources } from "@/lib/ops/receipts";
import { MAX_RECEIPT_PHOTOS, OTHER_GOODS, OTHER_UNITS, RAW_MATERIALS, RAW_UNITS } from "@/lib/ops/shared/goods";
import { DELIVERY_MODES, DELIVERY_MODE_LABELS } from "@/lib/ops/shared/sand";
import { Chips } from "./Chips";
import { PhotoPicker } from "./PhotoPicker";

const CATEGORIES = ["bahan_baku", "lainnya"] as const;
const CATEGORY_CHIPS: Record<ReceiptCategory, string> = { bahan_baku: "Bahan baku (pasir, abu batu, ...)", lainnya: "Barang lain (semen, besi, ...)" };

/** Form terima barang (satpam): chip jenis/barang/satuan, sumber dari riwayat (datalist), foto maksimal 3 dikompres di HP. */
export function ReceiveForm({ nowLocal, sources }: { nowLocal: string; sources: ReceiptSources }) {
  const [category, setCategory] = useState<ReceiptCategory>("bahan_baku");
  const [item, setItem] = useState<string>(RAW_MATERIALS[0]);
  const [otherItem, setOtherItem] = useState("");
  const [unit, setUnit] = useState<string>(RAW_UNITS[0]);
  const [mode, setMode] = useState<DeliveryMode | "">("");
  const [brangkal, setBrangkal] = useState<"ya" | "tidak">("tidak");
  const [status, setStatus] = useState<ReceiptStatus>("diterima");
  const raw = category === "bahan_baku";
  // Barang lain: nama spesifik yang diketik menang; "Lainnya" tanpa ketikan dianggap belum diisi.
  const itemName = raw ? item : otherItem.trim() || (item !== "Lainnya" && OTHER_GOODS.includes(item) ? item : "");

  function pickCategory(next: ReceiptCategory) {
    setCategory(next);
    setItem(next === "bahan_baku" ? RAW_MATERIALS[0] : OTHER_GOODS[0]);
    setUnit(next === "bahan_baku" ? RAW_UNITS[0] : OTHER_UNITS[0]);
    setOtherItem("");
  }

  return (
    <ActionForm action={createReceipt} className="form-section rcv-form">
      <datalist id="rcv-suppliers">{sources.suppliers.map((value) => <option key={value} value={value} />)}</datalist>
      <datalist id="rcv-quarries">{sources.quarries.map((value) => <option key={value} value={value} />)}</datalist>
      <datalist id="rcv-tags">{sources.tags.map((value) => <option key={value} value={value} />)}</datalist>
      <datalist id="rcv-expeditions">{sources.expeditions.map((value) => <option key={value} value={value} />)}</datalist>
      <datalist id="rcv-items">{[...new Set([...OTHER_GOODS.filter((name) => name !== "Lainnya"), ...sources.otherItems])].map((value) => <option key={value} value={value} />)}</datalist>

      <div>
        <h2>Terima barang masuk</h2>
        <p className="small muted">Catat setiap barang yang datang: jenis, jumlah, dan foto muatan / surat jalan.</p>
      </div>

      <div className="field">
        <span className="label">Jenis barang</span>
        <Chips name="category" value={category} options={CATEGORIES} labels={CATEGORY_CHIPS} onChange={pickCategory} label="Jenis barang" />
      </div>

      <div className="field">
        <span className="label">Barang</span>
        <Chips value={item} options={raw ? RAW_MATERIALS : OTHER_GOODS} onChange={setItem} label="Barang" />
        {!raw && (
          <input list="rcv-items" value={otherItem} onChange={(e) => setOtherItem(e.target.value)} aria-label="Nama barang" placeholder={item === "Lainnya" ? "Tulis nama barang" : "Nama lebih spesifik (opsional), mis. Semen Tiga Roda 50 kg"} maxLength={60} />
        )}
        <input type="hidden" name="itemName" value={itemName} />
      </div>

      <div className="field">
        <label htmlFor="rcv-qty">Jumlah</label>
        <input id="rcv-qty" name="quantity" className="num rcv-qty" inputMode="decimal" required placeholder="contoh 7" autoComplete="off" />
        <Chips name="unit" value={unit} options={raw ? RAW_UNITS : OTHER_UNITS} onChange={setUnit} label="Satuan" />
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="rcv-supplier">Supplier / toko</label>
          <input id="rcv-supplier" name="supplier" list="rcv-suppliers" maxLength={80} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="rcv-at">Tanggal &amp; jam datang</label>
          <input id="rcv-at" name="receivedAt" type="datetime-local" required defaultValue={nowLocal} />
        </div>
        {raw && (
          <>
            <div className="field">
              <label htmlFor="rcv-quarry">Quarry (asal tambang)</label>
              <input id="rcv-quarry" name="quarry" list="rcv-quarries" maxLength={80} placeholder="Contoh: Cidadap" autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor="rcv-tag">Tag (kategori inventory)</label>
              <input id="rcv-tag" name="tag" list="rcv-tags" maxLength={80} placeholder="Contoh: Pasir Cimalaka" autoComplete="off" />
            </div>
          </>
        )}
        <div className="field">
          <label htmlFor="rcv-plate">Plat truk</label>
          <input id="rcv-plate" name="vehiclePlate" className="rcv-upper" maxLength={20} placeholder="T 1234 AB" autoCapitalize="characters" autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="rcv-driver">Sopir</label>
          <input id="rcv-driver" name="driverName" maxLength={80} autoComplete="off" />
        </div>
        <div className="field span-2">
          <label htmlFor="rcv-sj">No. surat jalan</label>
          <input id="rcv-sj" name="deliveryNoteNo" maxLength={80} autoComplete="off" />
        </div>
      </div>

      <div className="field">
        <span className="label">Dikirim oleh</span>
        <Chips name="deliveryMode" value={mode} options={DELIVERY_MODES} labels={DELIVERY_MODE_LABELS} onChange={setMode} label="Dikirim oleh" />
        {mode === "ekspedisi" && <input name="expeditionName" list="rcv-expeditions" maxLength={80} placeholder="Nama ekspedisi" aria-label="Nama ekspedisi" autoComplete="off" />}
      </div>

      {raw && (
        <div className="field">
          <span className="label">Ada banyak brangkal (batu / kerikil besar)?</span>
          <Chips name="hasBrangkal" value={brangkal} options={["tidak", "ya"] as const} labels={{ tidak: "Tidak", ya: "Ya, banyak brangkal" }} onChange={setBrangkal} label="Brangkal" />
        </div>
      )}

      <div className="field">
        <span className="label">Foto barang / muatan / surat jalan (maks. {MAX_RECEIPT_PHOTOS})</span>
        <PhotoPicker name="photos" max={MAX_RECEIPT_PHOTOS} label="Foto barang masuk" hint="Foto sangat dianjurkan sebagai bukti." />
      </div>

      <div className="field">
        <span className="label">Status</span>
        <Chips name="status" value={status} options={["diterima", "ditolak"] as const} labels={{ diterima: "Diterima", ditolak: "Ditolak / dikembalikan" }} onChange={setStatus} label="Status" />
      </div>

      <div className="field">
        <label htmlFor="rcv-notes">Catatan</label>
        <textarea id="rcv-notes" name="notes" maxLength={1000} placeholder="Kondisi barang, kekurangan jumlah, dll." />
      </div>

      <div className="form-actions">
        <SubmitButton className="btn btn-primary btn-block rcv-save" pendingText="Menyimpan…">Simpan barang masuk</SubmitButton>
      </div>
    </ActionForm>
  );
}
