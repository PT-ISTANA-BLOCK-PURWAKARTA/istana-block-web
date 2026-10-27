"use client";

import { useMemo, useState } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { saveCount } from "@/app/operasional/actions/stock-count";
import { formatQty, parseQty } from "@/lib/erp/util";

export type CountItem = {
  id: string;
  code: string;
  name: string;
  unit: string;
  /** Kunci & label kelompok (kelompok barang jadi, atau "bahan"). */
  group: string;
  groupLabel: string;
  /** Stok web saat halaman dibuka. */
  system: number;
  last?: { date: string; counted: number } | null;
};

/**
 * Dokumen stok opname: pilih kelompok, isi jumlah fisik per barang (kosong = tidak dihitung), selisih terhitung otomatis
 * terhadap stok web. Simpan memposting penyesuaian untuk tiap selisih.
 */
export function CountForm({ items, nowLocal }: { items: CountItem[]; nowLocal: string }) {
  const groups = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of items) if (!m.has(i.group)) m.set(i.group, i.groupLabel);
    return [...m.entries()];
  }, [items]);
  const [group, setGroup] = useState<string>("");
  const [vals, setVals] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const shown = items.filter((i) => (!group || i.group === group) && (!q || `${i.name} ${i.code}`.toLowerCase().includes(q.toLowerCase())));
  const filled = items.filter((i) => (vals[i.id] ?? "").trim() !== "");
  const diffs = filled.filter((i) => Math.round((parseQty(vals[i.id]) - i.system) * 1000) !== 0).length;
  const payload = JSON.stringify(filled.map((i) => ({ itemId: i.id, counted: vals[i.id] })));

  return (
    <ActionForm action={saveCount} className="stack" style={{ gap: 20 }}>
      <input type="hidden" name="lines" value={payload} />
      <section className="form-section">
        <p className="small muted">Isi jumlah fisik yang ada di gudang. Barang yang dibiarkan kosong tidak dihitung. Selisih terhadap stok di sistem diposting sebagai penyesuaian stok (tambah / kurang) saat disimpan.</p>
        <div className="form-grid cols-4">
          <div className="field"><label htmlFor="op-at">Waktu hitung</label><input id="op-at" name="countedAt" type="datetime-local" defaultValue={nowLocal} required /></div>
          <div className="field span-3"><label htmlFor="op-note">Catatan <span className="help">opsional</span></label><input id="op-note" name="note" maxLength={300} placeholder="Mis. opname akhir bulan" /></div>
        </div>
      </section>

      <section className="form-section">
        <div className="prd-choices" role="group" aria-label="Kelompok barang">
          <button type="button" className="prd-choice" aria-pressed={group === ""} onClick={() => setGroup("")}>Semua</button>
          {groups.map(([k, label]) => (
            <button key={k} type="button" className="prd-choice" aria-pressed={group === k} onClick={() => setGroup(k)}>{label}</button>
          ))}
        </div>
        <div className="field"><label htmlFor="op-q">Cari barang</label><input id="op-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nama atau kode" autoComplete="off" /></div>
        <div className="admin-table">
          <table>
            <thead><tr><th>Barang</th><th className="num">Di sistem</th><th className="num">Fisik</th><th className="num">Selisih</th></tr></thead>
            <tbody>
              {shown.map((i) => {
                const raw = vals[i.id] ?? "";
                const diff = raw.trim() === "" ? null : Math.round((parseQty(raw) - i.system) * 1000) / 1000;
                return (
                  <tr key={i.id}>
                    <td>
                      <b>{i.name}</b>
                      <div className="small muted">{i.code}{i.last ? ` · opname terakhir ${formatQty(i.last.counted)} (${i.last.date})` : " · belum pernah opname"}</div>
                    </td>
                    <td className={`num${i.system < 0 ? " text-bahaya" : ""}`}>{formatQty(i.system)} {i.unit}</td>
                    <td className="num"><input aria-label={`Jumlah fisik ${i.name}`} className="num" inputMode="decimal" value={raw} placeholder="-" onChange={(e) => setVals((v) => ({ ...v, [i.id]: e.target.value }))} style={{ width: 110 }} /></td>
                    <td className={`num${diff ? (diff < 0 ? " text-bahaya" : " text-ok") : ""}`}>{diff == null ? "" : `${diff > 0 ? "+" : ""}${formatQty(diff)} ${i.unit}`}</td>
                  </tr>
                );
              })}
              {shown.length === 0 && <tr><td colSpan={4} className="muted" style={{ padding: 24 }}>Belum ada barang untuk kelompok ini.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="form-actions">
        <SubmitButton className="btn btn-primary prd-save">Simpan stok opname</SubmitButton>
        <span className="small muted">{filled.length} barang dihitung · {diffs} selisih akan diposting</span>
      </div>
    </ActionForm>
  );
}
