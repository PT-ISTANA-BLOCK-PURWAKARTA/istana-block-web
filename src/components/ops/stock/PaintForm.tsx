"use client";

import { useState } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { saveConversion } from "@/app/operasional/actions/conversions";
import { Select } from "@/components/ui";
import { formatQty, parseQty } from "@/lib/erp/util";
import { GENTENG_COLOR_LABEL, type GentengColor } from "@/lib/ops/production-lines";

export type PaintItem = { id: string; name: string; unit: string; color: GentengColor; type: string; stock: number };

/**
 * Cat genteng: genteng natural yang dicat mengurangi stok natural dan menambah stok warna (hitam / merah) untuk tipe yang sama.
 * Pasangan warna dicari dari barang dengan tipe (nama tanpa kata warna) yang sama.
 */
export function PaintForm({ items, nowLocal }: { items: PaintItem[]; nowLocal: string }) {
  const naturals = items.filter((i) => i.color === "natural");
  const [from, setFrom] = useState("");
  const [color, setColor] = useState<Exclude<GentengColor, "natural">>("hitam");
  const [qty, setQty] = useState("");
  const src = naturals.find((i) => i.id === from);
  const dest = src ? items.find((i) => i.color === color && i.type === src.type) : undefined;
  const n = parseQty(qty);
  const over = !!src && n > src.stock + 0.0005;

  return (
    <ActionForm action={saveConversion} className="stack" style={{ gap: 16 }}>
      <input type="hidden" name="fromItemId" value={from} />
      <input type="hidden" name="toItemId" value={dest?.id ?? ""} />
      <section className="form-section">
        <p className="small muted">Genteng natural yang dicat mengurangi stok <b>natural</b> dan menambah stok warna (hitam / merah) untuk tipe yang sama. Bukan hasil produksi baru.</p>
        <div className="field">
          <label htmlFor="cg-from">Tipe genteng (stok natural)</label>
          <Select id="cg-from" value={from} onChange={setFrom} searchable placeholder="Pilih tipe genteng…" options={naturals.map((i) => ({ value: i.id, label: i.name, hint: `stok ${formatQty(i.stock)} ${i.unit}` }))} />
          {src && <span className="help">Stok natural saat ini: <b>{formatQty(src.stock)} {src.unit}</b></span>}
          {naturals.length === 0 && <span className="help">Belum ada barang genteng. Buat barang jadi bernama &ldquo;Genteng …&rdquo; (atau isi kelompok &ldquo;Genteng Beton&rdquo; di data barang) untuk natural, hitam, dan merah.</span>}
        </div>
        <div className="field">
          <span className="label">Dicat warna</span>
          <div className="prd-choices" role="group" aria-label="Warna">
            {(["hitam", "merah"] as const).map((c) => (
              <button key={c} type="button" className="prd-choice" aria-pressed={color === c} onClick={() => setColor(c)}>{GENTENG_COLOR_LABEL[c]}</button>
            ))}
          </div>
          {src && (dest ? <span className="help">Menjadi: <b>{dest.name}</b></span> : <span className="help text-bahaya">Belum ada barang genteng {GENTENG_COLOR_LABEL[color].toLowerCase()} untuk tipe ini. Buat dulu barang jadi &ldquo;{src.type} {GENTENG_COLOR_LABEL[color]}&rdquo;.</span>)}
        </div>
        <div className="form-grid cols-4">
          <div className="field"><label htmlFor="cg-qty">Jumlah {src ? `(${src.unit})` : "(buah)"}</label><input id="cg-qty" name="qty" className="num" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} required placeholder="0" /></div>
          <div className="field span-2"><label htmlFor="cg-at">Waktu</label><input id="cg-at" name="movedAt" type="datetime-local" defaultValue={nowLocal} required /></div>
        </div>
        <div className="field"><label htmlFor="cg-note">Catatan <span className="help">opsional</span></label><input id="cg-note" name="note" maxLength={300} /></div>
        {over && (
          <label className="check alert alert-warn">
            <input type="checkbox" name="force" /> Stok {src?.name} di sistem hanya {formatQty(src?.stock ?? 0)} {src?.unit}. Tetap simpan.
          </label>
        )}
      </section>
      <div className="form-actions"><SubmitButton className="btn btn-primary prd-save">Simpan</SubmitButton></div>
    </ActionForm>
  );
}
