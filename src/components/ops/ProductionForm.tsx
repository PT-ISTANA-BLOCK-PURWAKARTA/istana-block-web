"use client";

import { useState, useTransition } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { fillProductionFromMix, saveProduction } from "@/app/operasional/actions/stock";
import { ProofInput } from "@/components/ops/ProofInput";
import { CATEGORY_LABEL, type ProdCategory } from "@/components/ops/production/summary";
import { DateField, Select } from "@/components/ui";
import { formatQty, parseQty } from "@/lib/erp/util";
import { PRODUCTION_ISSUES } from "@/lib/ops/shared/goods";

type Opt = { id: string; code: string; name: string; unit: string; kind: string; category?: ProdCategory };
type Row = { itemId: string; qty: string };

function Rows({ title, help, rows, setRows, options }: { title: string; help: string; rows: Row[]; setRows: (f: (r: Row[]) => Row[]) => void; options: Opt[] }) {
  const unit = (id: string) => options.find((o) => o.id === id)?.unit ?? "";
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="card-head" style={{ marginBottom: 0 }}><h2>{title}</h2><span className="small muted">{help}</span></div>
      <div className="lines-table plines">
        {rows.map((r, i) => (
          <div className="lines-row" key={i}>
            <Select aria-label={`${title} baris ${i + 1}`} value={r.itemId} onChange={(v) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, itemId: v } : x)))} placeholder="Pilih barang…" searchable menuWidth={300} options={options.map((o) => ({ value: o.id, label: o.name, hint: o.code }))} />
            <div className="inline-form">
              <input aria-label={`Qty ${title} baris ${i + 1}`} className="num" inputMode="decimal" value={r.qty} placeholder="0" onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
              <span className="small muted" style={{ minWidth: 32 }}>{unit(r.itemId)}</span>
            </div>
            <button type="button" className="icon-btn" aria-label={`Hapus baris ${i + 1}`} onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : [{ itemId: "", qty: "" }]))}>×</button>
          </div>
        ))}
      </div>
      <div><button type="button" className="btn btn-ghost btn-sm" onClick={() => setRows((rs) => [...rs, { itemId: "", qty: "" }])}>+ Tambah baris</button></div>
    </div>
  );
}

export type ProductionFormProps = {
  id?: string;
  date: string;
  category: ProdCategory;
  /** Kategori yang boleh dipilih akun ini. */
  categories: ProdCategory[];
  note?: string;
  laborCost?: number;
  showCost: boolean;
  leader?: string;
  target?: string;
  cementBags?: string;
  boards?: string;
  rejects?: string;
  batchCode?: string;
  issues?: string[];
  photoKey?: string | null;
  hasil: Row[];
  bahan: Row[];
  items: Opt[];
  leaders: string[];
};

const blank = (rs: Row[]) => (rs.length ? rs : [{ itemId: "", qty: "" }]);
const MAT_UNIT = /^m[²2]$/i;

/**
 * Catat hasil produksi: barang jadi masuk, bahan baku keluar, biaya produksi diserap ke nilai persediaan,
 * ditambah isian lapangan (kategori, ketua regu, target, sak semen, papan, reject, kendala, foto).
 * Satu kolom, tombol besar: dipakai mandor/QC dari HP.
 */
export function ProductionForm(p: ProductionFormProps) {
  const [category, setCategory] = useState<ProdCategory>(p.category);
  const [date, setDate] = useState(p.date);
  const [out, setOut] = useState<Row[]>(blank(p.hasil));
  const [used, setUsed] = useState<Row[]>(blank(p.bahan));
  const [boards, setBoards] = useState(p.boards ?? "");
  const [rejects, setRejects] = useState(p.rejects ?? "");
  const [issues, setIssues] = useState<string[]>(p.issues ?? []);
  const [mix, setMix] = useState<{ error?: string; lines: string[] } | null>(null);
  const [mixBusy, startMix] = useTransition();
  const paving = category === "paving";

  const ser = (rs: Row[]) => JSON.stringify(rs.map((r) => ({ itemId: r.itemId, qty: parseQty(r.qty) })).filter((r) => r.itemId || r.qty));
  const finished = p.items.filter((i) => i.kind === "barang_jadi" && i.category === category);
  const raw = p.items.filter((i) => i.kind === "bahan_baku");

  function fillFromMix() {
    setMix(null);
    startMix(async () => {
      const r = await fillProductionFromMix(date);
      if ("error" in r) {
        setMix({ error: r.error, lines: [] });
        return;
      }
      const rows = out.filter((x) => x.itemId || x.qty);
      const lines: string[] = [];
      let boardsSum = 0;
      let rejectSum = 0;
      for (const m of r.products) {
        boardsSum += m.boards;
        rejectSum += m.rejects;
        const detail = `${formatQty(m.squareMeters)} m², ${formatQty(m.boards)} papan, reject ${formatQty(m.rejects)}`;
        const it = m.item;
        if (!it) {
          lines.push(`${m.product}: ${detail}. Tidak ada barang jadi bernama mirip; pilih barangnya sendiri.`);
          continue;
        }
        const idx = rows.findIndex((x) => x.itemId === it.id);
        if (MAT_UNIT.test(it.unit.trim())) {
          const qty = formatQty(m.squareMeters);
          if (idx >= 0) rows[idx] = { ...rows[idx], qty };
          else rows.push({ itemId: it.id, qty });
          lines.push(`${m.product} → ${it.name}: ${detail}.`);
        } else {
          if (idx < 0) rows.push({ itemId: it.id, qty: "" });
          lines.push(`${m.product} → ${it.name}: ${detail}. Satuan barang ${it.unit}, isi jumlahnya sendiri.`);
        }
      }
      setOut(blank(rows));
      if (boardsSum) setBoards(formatQty(boardsSum));
      if (rejectSum) setRejects(formatQty(rejectSum));
      setMix({ lines });
    });
  }

  const toggleIssue = (issue: string) => setIssues((is) => (is.includes(issue) ? is.filter((x) => x !== issue) : [...is, issue]));

  return (
    <ActionForm action={saveProduction} className="stack prd-form" style={{ gap: 20 }}>
      {p.id && <input type="hidden" name="id" value={p.id} />}
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="hasil" value={ser(out)} />
      <input type="hidden" name="bahan" value={ser(used)} />
      <input type="hidden" name="issues" value={JSON.stringify(issues)} />

      <section className="form-section">
        {p.categories.length > 1 && (
          <div className="field">
            <label id="prd-cat-l">Kategori</label>
            <div className="prd-choices" role="group" aria-labelledby="prd-cat-l">
              {p.categories.map((c) => (
                <button key={c} type="button" className="prd-choice" aria-pressed={category === c} onClick={() => { setCategory(c); setOut((rs) => blank(rs.filter((r) => !r.itemId || p.items.find((i) => i.id === r.itemId)?.category === c))); }}>{CATEGORY_LABEL[c]}</button>
              ))}
            </div>
          </div>
        )}
        <div className="form-grid cols-4">
          <div className="field"><label htmlFor="pr-date">Tanggal produksi</label><DateField id="pr-date" name="date" value={date} onChange={setDate} required /></div>
          <div className="field span-2">
            <label htmlFor="pr-leader">Ketua regu</label>
            <input id="pr-leader" name="leader" list="pr-leaders" defaultValue={p.leader} placeholder="Nama ketua regu" autoComplete="off" />
            <datalist id="pr-leaders">{p.leaders.map((l) => <option key={l} value={l} />)}</datalist>
          </div>
          <div className="field">
            <label htmlFor="pr-batch">Kode batch <span className="help">{p.batchCode ? "boleh diubah" : "otomatis bila kosong"}</span></label>
            <input id="pr-batch" name="batchCode" defaultValue={p.batchCode} placeholder="Otomatis" autoCapitalize="characters" autoComplete="off" />
          </div>
        </div>
      </section>

      <section className="form-section">
        <Rows title="Hasil produksi" help="barang jadi yang dihasilkan; isi 0 bila berhenti" rows={out} setRows={setOut} options={finished} />
        {paving && (
          <div className="stack" style={{ gap: 8 }}>
            <div><button type="button" className="btn btn-ghost btn-sm prd-mix" onClick={fillFromMix} disabled={mixBusy}>{mixBusy ? "Mengambil…" : "Isi dari catatan mix desain tanggal ini"}</button></div>
            {mix?.error && <p className="alert alert-warn" role="status">{mix.error}</p>}
            {mix && !mix.error && (
              <div className="alert alert-ok" role="status">
                <b>Diisi dari catatan mix desain (lapisan badan).</b> Periksa lagi angkanya.
                <ul className="prd-mix-list">{mix.lines.map((l) => <li key={l}>{l}</li>)}</ul>
              </div>
            )}
          </div>
        )}
        <div className="form-grid cols-4">
          <div className="field"><label htmlFor="pr-target">Target <span className="help">satuan hasil</span></label><input id="pr-target" name="target" className="num" inputMode="decimal" defaultValue={p.target} placeholder="0" /></div>
          <div className="field"><label htmlFor="pr-cement">Semen <span className="help">sak</span></label><input id="pr-cement" name="cementBags" className="num" inputMode="decimal" defaultValue={p.cementBags} placeholder="0" /></div>
          {paving && <div className="field"><label htmlFor="pr-boards">Papan</label><input id="pr-boards" name="boards" className="num" inputMode="decimal" value={boards} onChange={(e) => setBoards(e.target.value)} placeholder="0" /></div>}
          <div className="field"><label htmlFor="pr-rejects">Reject</label><input id="pr-rejects" name="rejects" className="num" inputMode="decimal" value={rejects} onChange={(e) => setRejects(e.target.value)} placeholder="0" /></div>
        </div>
      </section>

      <section className="form-section">
        <div className="card-head" style={{ marginBottom: 0 }}><h2>Kendala produksi</h2><span className="small muted">opsional; bila produksi berhenti isi hasil 0 lalu pilih kendalanya</span></div>
        <div className="prd-choices">
          {PRODUCTION_ISSUES.map((issue) => (
            <button key={issue} type="button" className="prd-choice prd-issue" aria-pressed={issues.includes(issue)} onClick={() => toggleIssue(issue)}>{issues.includes(issue) ? "✓ " : ""}{issue}</button>
          ))}
        </div>
        <div className="field">
          <label htmlFor="pr-note">Catatan {issues.length > 0 && <span className="help">jelaskan kendalanya</span>}</label>
          <textarea id="pr-note" name="note" rows={3} defaultValue={p.note} placeholder="Contoh: mesin press 2 mati jam 10–13, menunggu teknisi; produksi dilanjut sore." />
        </div>
        <ProofInput id="pr-photo" label="Foto hasil produksi" help={p.photoKey ? "ambil foto baru untuk mengganti" : "opsional"} />
        {p.photoKey && (
          <a href={`/operasional/berkas/${p.photoKey}`} target="_blank" rel="noreferrer" className="prd-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/operasional/berkas/${p.photoKey}`} alt="Foto produksi tersimpan" />
            <span className="small muted">Foto tersimpan</span>
          </a>
        )}
      </section>

      <details className="form-section prd-bahan" open={p.bahan.length > 0}>
        <summary><b>Bahan terpakai</b> <span className="small muted">opsional; mengurangi stok bahan baku</span></summary>
        <Rows title="Bahan terpakai" help="bahan baku yang keluar dari gudang" rows={used} setRows={setUsed} options={raw.length ? raw : p.items} />
      </details>

      {p.showCost && (
        <section className="form-section">
          <div className="field">
            <label htmlFor="pr-labor">Biaya produksi (Rp) <span className="help">upah, listrik, dll.</span></label>
            <input id="pr-labor" name="laborCost" className="num" inputMode="numeric" defaultValue={p.laborCost != null ? String(p.laborCost) : ""} placeholder="otomatis" />
          </div>
          <p className="small muted">
            Nilai hasil = nilai bahan (harga pokok rata-rata) + biaya produksi. Bila biaya produksi dikosongkan, sistem mengisinya supaya nilai hasil sama dengan harga pokok standar barang (diatur di data barang).
          </p>
        </section>
      )}

      <div className="form-actions"><SubmitButton className="btn btn-primary prd-save">{p.id ? "Simpan perubahan" : "Simpan hasil produksi"}</SubmitButton></div>
    </ActionForm>
  );
}
