"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { fillProductionFromMix, saveProduction } from "@/app/operasional/actions/stock";
import { ProofInput } from "@/components/ops/ProofInput";
import { CATEGORY_LABEL, type ProdCategory } from "@/components/ops/production/summary";
import { DateField, Select } from "@/components/ui";
import type { ProductLine, ProductionMethod } from "@/db/erp";
import { formatQty, parseQty } from "@/lib/erp/util";
import { PRODUCTION_ISSUES } from "@/lib/ops/shared/goods";
import { estimateWeight, METHOD_LABEL } from "@/lib/ops/production-lines";

export type Opt = { id: string; code: string; name: string; unit: string; kind: string; category?: ProdCategory; line?: ProductLine | null; method?: ProductionMethod | null };
export type SpecOpt = { id: string; line: ProductLine; name: string; variant: string | null; weightKg: number | null; specs: Record<string, string>; itemId: string | null };
type Row = { itemId: string; qty: string };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Spesifikasi barang: tautan langsung (item_id), atau spesifikasi sekelompok yang namanya termuat di nama barang. */
function specFor(item: Opt | undefined, specs: SpecOpt[]) {
  if (!item) return undefined;
  const linked = specs.find((s) => s.itemId === item.id);
  if (linked) return linked;
  const n = norm(item.name);
  return specs.find((s) => !s.itemId && (!item.line || s.line === item.line) && norm(s.name).length >= 3 && n.includes(norm(s.name)));
}

function Rows({ title, help, rows, setRows, options, specs }: { title: string; help: string; rows: Row[]; setRows: (f: (r: Row[]) => Row[]) => void; options: Opt[]; specs?: SpecOpt[] }) {
  const unit = (id: string) => options.find((o) => o.id === id)?.unit ?? "";
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="card-head" style={{ marginBottom: 0 }}><h2>{title}</h2><span className="small muted">{help}</span></div>
      <div className="lines-table plines">
        {rows.map((r, i) => {
          const it = options.find((o) => o.id === r.itemId);
          const sp = specs ? specFor(it, specs) : undefined;
          const total = sp && it ? estimateWeight(sp.weightKg, parseQty(r.qty), it.unit) : null;
          return (
            <div className="lines-row" key={i}>
              <Select aria-label={`${title} baris ${i + 1}`} value={r.itemId} onChange={(v) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, itemId: v } : x)))} placeholder="Pilih barang…" searchable menuWidth={300} options={options.map((o) => ({ value: o.id, label: o.name, hint: o.code }))} />
              <div className="inline-form">
                <input aria-label={`Qty ${title} baris ${i + 1}`} className="num" inputMode="decimal" value={r.qty} placeholder="0" onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
                <span className="small muted" style={{ minWidth: 32 }}>{unit(r.itemId)}</span>
              </div>
              <button type="button" className="icon-btn" aria-label={`Hapus baris ${i + 1}`} onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : [{ itemId: "", qty: "" }]))}>×</button>
              {sp && (
                <p className="small muted prd-spec" style={{ gridColumn: "1 / -1", margin: 0 }}>
                  {sp.weightKg != null && <>Berat {formatQty(sp.weightKg)} kg / {it?.unit || "buah"}{total != null && <> · ≈ total {formatQty(Math.round(total * 100) / 100)} kg</>}</>}
                  {Object.keys(sp.specs).length > 0 && <>{sp.weightKg != null ? " · " : ""}{Object.entries(sp.specs).map(([k, v]) => `${k}: ${v}`).join(" · ")}</>}
                </p>
              )}
            </div>
          );
        })}
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
  cementKg?: string;
  boards?: string;
  rejects?: string;
  gradeB?: string;
  method?: ProductionMethod | null;
  batchCode?: string;
  issues?: string[];
  photoKey?: string | null;
  hasil: Row[];
  bahan: Row[];
  items: Opt[];
  leaders: string[];
  specs?: SpecOpt[];
};

const blank = (rs: Row[]) => (rs.length ? rs : [{ itemId: "", qty: "" }]);
const MAT_UNIT = /^m[²2]$/i;

/**
 * Catat hasil produksi: barang jadi masuk (Grade A), Grade B & reject dicatat, bahan baku keluar, biaya produksi diserap ke nilai
 * persediaan, ditambah isian lapangan (kategori, metode Buis, ketua regu, target, semen, papan, kendala, foto).
 * Satu kolom, tombol besar: dipakai mandor/QC dari HP.
 */
export function ProductionForm(p: ProductionFormProps) {
  const [category, setCategory] = useState<ProdCategory>(p.category);
  const [date, setDate] = useState(p.date);
  const [out, setOut] = useState<Row[]>(blank(p.hasil));
  const [used, setUsed] = useState<Row[]>(blank(p.bahan));
  const [boards, setBoards] = useState(p.boards ?? "");
  const [rejects, setRejects] = useState(p.rejects ?? "");
  const [gradeB, setGradeB] = useState(p.gradeB ?? "");
  const [issues, setIssues] = useState<string[]>(p.issues ?? []);
  const [method, setMethod] = useState<ProductionMethod | "">(p.method ?? "");
  const [mix, setMix] = useState<{ error?: string; lines: string[] } | null>(null);
  const [mixBusy, startMix] = useTransition();
  const paving = category === "paving";

  const ser = (rs: Row[]) => JSON.stringify(rs.map((r) => ({ itemId: r.itemId, qty: parseQty(r.qty) })).filter((r) => r.itemId || r.qty));
  const finished = p.items.filter((i) => i.kind === "barang_jadi" && i.category === category);
  const raw = p.items.filter((i) => i.kind === "bahan_baku");
  const buisItem = out.map((r) => p.items.find((i) => i.id === r.itemId)).find((i) => i?.line === "buis");
  const showMethod = !!buisItem;
  const methodValue = showMethod ? method || buisItem?.method || "" : "";

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
      let gradeBSum = 0;
      for (const m of r.products) {
        boardsSum += m.boards;
        rejectSum += m.rejects;
        gradeBSum += m.gradeB;
        const detail = `${formatQty(m.squareMeters)} m² Grade A, ${formatQty(m.boards)} papan, Grade B ${formatQty(m.gradeB)}, reject ${formatQty(m.rejects)}`;
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
        if (m.halfPieces > 0) {
          const h = m.halfItem;
          if (h) {
            const qty = formatQty(m.halfPieces);
            const hi = rows.findIndex((x) => x.itemId === h.id);
            if (hi >= 0) rows[hi] = { ...rows[hi], qty };
            else rows.push({ itemId: h.id, qty });
            lines.push(`Belahan ${formatQty(m.halfPieces)} buah → ${h.name}.`);
          } else {
            lines.push(`Belahan ${formatQty(m.halfPieces)} buah: tidak ada barang "Hexagon Setengah (trapesium)" warna yang sama; buat barangnya dulu.`);
          }
        }
      }
      setOut(blank(rows));
      if (boardsSum) setBoards(formatQty(boardsSum));
      if (rejectSum) setRejects(formatQty(rejectSum));
      if (gradeBSum) setGradeB(formatQty(gradeBSum));
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
      <input type="hidden" name="method" value={methodValue} />

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
        {!p.id && !paving && (
          <p className="small muted">Buis cor / tulangan, U-Ditch &amp; Kanstin yang dicor dari satu adukan: pakai <Link href="/operasional/produksi/adukan/baru"><b>Input adukan cor</b></Link>.</p>
        )}
      </section>

      <section className="form-section">
        <Rows title="Hasil produksi (Grade A)" help="barang jadi yang menambah stok; isi 0 bila berhenti" rows={out} setRows={setOut} options={finished} specs={p.specs} />
        {showMethod && (
          <div className="field">
            <label id="prd-method-l">Metode Buis Beton</label>
            <div className="prd-choices" role="group" aria-labelledby="prd-method-l">
              {(Object.keys(METHOD_LABEL) as ProductionMethod[]).map((m) => (
                <button key={m} type="button" className="prd-choice" aria-pressed={methodValue === m} onClick={() => setMethod(m)}>{METHOD_LABEL[m]}</button>
              ))}
            </div>
          </div>
        )}
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
            <p className="small muted">Catatan Mix Desain harian yang barangnya cocok otomatis menjadi baris produksi (ditandai &ldquo;Dari mix desain&rdquo;); tombol ini hanya untuk yang belum otomatis.</p>
          </div>
        )}
        <div className="form-grid cols-4">
          <div className="field"><label htmlFor="pr-target">Target <span className="help">satuan hasil</span></label><input id="pr-target" name="target" className="num" inputMode="decimal" defaultValue={p.target} placeholder="0" /></div>
          {paving ? (
            <div className="field"><label htmlFor="pr-cementkg">Semen curah <span className="help">kg</span></label><input id="pr-cementkg" name="cementKg" className="num" inputMode="decimal" defaultValue={p.cementKg} placeholder="0" /></div>
          ) : (
            <div className="field"><label htmlFor="pr-cement">Semen <span className="help">sak</span></label><input id="pr-cement" name="cementBags" className="num" inputMode="decimal" defaultValue={p.cementBags} placeholder="0" /></div>
          )}
          {paving && <div className="field"><label htmlFor="pr-boards">Papan</label><input id="pr-boards" name="boards" className="num" inputMode="decimal" value={boards} onChange={(e) => setBoards(e.target.value)} placeholder="0" /></div>}
          <div className="field"><label htmlFor="pr-gradeb">Grade B <span className="help">masih bisa dijual</span></label><input id="pr-gradeb" name="gradeB" className="num" inputMode="decimal" value={gradeB} onChange={(e) => setGradeB(e.target.value)} placeholder="0" /></div>
          <div className="field"><label htmlFor="pr-rejects">Reject <span className="help">tidak bisa dijual</span></label><input id="pr-rejects" name="rejects" className="num" inputMode="decimal" value={rejects} onChange={(e) => setRejects(e.target.value)} placeholder="0" /></div>
        </div>
        <p className="small muted">Hanya Grade A yang menambah stok. Grade B &amp; reject hanya dicatat; bila ada, Manager in charge lalu Pimpinan menandatangani ketidaksesuaiannya di daftar hasil produksi.</p>
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
