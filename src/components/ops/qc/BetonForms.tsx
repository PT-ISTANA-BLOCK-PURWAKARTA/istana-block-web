"use client";

// Formulir QC Beton: template mix beton, catatan mix beton harian, dan waktu produksi terbuang.
// Setara app lama (BetonMixTab & DowntimePanel): produk U-Ditch / Buis Beton vibrasi / Kanstin, status mix otomatis.
import Link from "next/link";
import { useState } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { saveDowntime } from "@/app/operasional/actions/downtime";
import { createMixDesign, createMixLog, updateMixLog } from "@/app/operasional/actions/qc";
import { DateField } from "@/components/ui";
import type { MaterialLine } from "@/db/erp";
import { CHECK_STATUS_LABELS, fromRows, materialText, toRows, type MatRow } from "./labels";
import { MaterialEditor } from "./MaterialEditor";
import "./qc.css";

/** Produk beton yang memakai mix desain QC Beton. */
export const BETON_MIX_PRODUCTS = ["U-Ditch", "Buis Beton vibrasi", "Kanstin"];
export const DEFAULT_BETON_MATERIALS: MaterialLine[] = [
  { name: "Semen", qty: null, unit: "sak" },
  { name: "Pasir", qty: null, unit: "kg" },
  { name: "Split", qty: null, unit: "kg" },
  { name: "Abu batu", qty: null, unit: "kg" },
  { name: "Air", qty: null, unit: "liter" },
];

const splitProducts = (text: string) => text.split(",").map((s) => s.trim()).filter(Boolean);
const num = (v: string) => {
  const n = Number(v.replace(",", "."));
  return v.trim() === "" || !Number.isFinite(n) ? null : n;
};

/** Sesuai bila takaran actual yang diisi sama dengan yang disetujui (bahan yang tidak diisi diabaikan). */
function mixStatus(approved: MatRow[], actual: MatRow[]): "sesuai" | "tidak_sesuai" {
  const plan = new Map(approved.map((m) => [m.name.trim().toLowerCase(), num(m.qty)]));
  for (const a of actual) {
    const used = num(a.qty);
    if (used === null) continue;
    const target = plan.get(a.name.trim().toLowerCase());
    if (target === undefined ? used > 0 : target !== null && Math.abs(used - target) > 1e-9) return "tidak_sesuai";
  }
  return "sesuai";
}

/** Pilih satu / beberapa produk (mis. U-Ditch & Kanstin dari satu adukan). */
function ProductChips({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const picked = splitProducts(value);
  const toggle = (name: string) => onChange((picked.includes(name) ? picked.filter((p) => p !== name) : [...picked, name]).join(", "));
  return (
    <div className="seg" role="group" aria-label="Produk">
      {BETON_MIX_PRODUCTS.map((name) => (
        <button key={name} type="button" className={`seg-opt${picked.includes(name) ? " on" : ""}`} aria-pressed={picked.includes(name)} onClick={() => toggle(name)}>
          {picked.includes(name) ? "✓ " : "+ "}
          {name}
        </button>
      ))}
    </div>
  );
}

/** Ajukan (QC Beton) / buat (kantor) template mix beton. */
export function BetonDesignForm({ canApprove, back }: { canApprove: boolean; back: string }) {
  const [product, setProduct] = useState("");
  const [mats, setMats] = useState(() => toRows(DEFAULT_BETON_MATERIALS));
  return (
    <ActionForm action={createMixDesign} className="stack" style={{ gap: 20 }}>
      <input type="hidden" name="scope" value="beton" />
      <input type="hidden" name="layer" value="lainnya" />
      <input type="hidden" name="product" value={product} />
      <input type="hidden" name="materials" value={JSON.stringify(fromRows(mats))} />
      <section className="form-section">
        <div className="field">
          <span className="label">Produk</span>
          <ProductChips value={product} onChange={setProduct} />
        </div>
        <div className="field">
          <label htmlFor="bd-name">Nama template</label>
          <input id="bd-name" name="name" required minLength={2} maxLength={100} placeholder="Contoh: K-300 U-Ditch" />
        </div>
        <div className="field">
          <span className="label">Bahan per adukan</span>
          <MaterialEditor items={mats} onChange={setMats} />
        </div>
        <div className="field">
          <label htmlFor="bd-notes">Catatan</label>
          <textarea id="bd-notes" name="notes" maxLength={1000} />
        </div>
      </section>
      <div className="form-actions">
        <SubmitButton>{canApprove ? "Simpan template" : "Ajukan"}</SubmitButton>
        <Link href={back} className="btn btn-ghost">Batal</Link>
      </div>
    </ActionForm>
  );
}

export type BetonDesignOption = { id: string; name: string; product: string; materials: MaterialLine[] };
export type BetonLogInitial = { id?: string; workDate: string; mixDesignId: string; product: string; approved: MaterialLine[]; actual: MaterialLine[]; mixingCount: string; leader: string; notes: string };

/** Isi / ubah catatan mix beton harian. "Disetujui" dari template; "Actual" sesuai takaran di lapangan. */
export function BetonMixForm({ initial, designs, back }: { initial: BetonLogInitial; designs: BetonDesignOption[]; back: string }) {
  const [designId, setDesignId] = useState(initial.mixDesignId);
  const [product, setProduct] = useState(initial.product);
  const [approved, setApproved] = useState(() => toRows(initial.approved));
  const [actualRaw, setActualRaw] = useState(() => toRows(initial.actual));
  const actual = approved.map((m) => actualRaw.find((a) => a.name === m.name) ?? { ...m, qty: "" });
  const status = mixStatus(approved, actual);

  function pickDesign(value: string) {
    const d = designs.find((x) => x.id === value);
    if (!d) return setDesignId("");
    setDesignId(d.id);
    setProduct((p) => p || d.product);
    setApproved(toRows(d.materials));
    setActualRaw(toRows(d.materials));
  }

  return (
    <ActionForm action={initial.id ? updateMixLog : createMixLog} className="stack" style={{ gap: 20 }}>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="scope" value="beton" />
      <input type="hidden" name="layer" value="lainnya" />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="product" value={product} />
      <input type="hidden" name="mixDesignId" value={designId} />
      <input type="hidden" name="approved" value={JSON.stringify(fromRows(approved))} />
      <input type="hidden" name="actual" value={JSON.stringify(fromRows(actual))} />
      <section className="form-section">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="bm-date">Hari / tanggal</label>
            <DateField id="bm-date" name="workDate" defaultValue={initial.workDate} required />
          </div>
          <div className="field">
            <label htmlFor="bm-design">Template disetujui</label>
            <select id="bm-design" value={designId} onChange={(e) => pickDesign(e.target.value)}>
              <option value="">— Tanpa template (isi manual) —</option>
              {designs.map((d) => (
                <option key={d.id} value={d.id}>{d.name} · {d.product}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <span className="label">Produk <span className="help">boleh beberapa, satu adukan</span></span>
          <ProductChips value={product} onChange={setProduct} />
        </div>
      </section>
      <section className="form-section">
        <div className="form-grid">
          <div className="field">
            <span className="label">Mix desain disetujui</span>
            {designId ? <p className="qc-readonly">{materialText(fromRows(approved))}</p> : <MaterialEditor label="Disetujui" items={approved} onChange={setApproved} />}
          </div>
          <div className="field">
            <span className="label">Mix desain actual <span className="help">isi sesuai yang benar-benar dipakai</span></span>
            <MaterialEditor label="Actual" fixedNames items={actual} onChange={setActualRaw} />
          </div>
        </div>
      </section>
      <section className="form-section">
        <div className="form-grid">
          <div className="field"><label htmlFor="bm-mix">Mixing <span className="help">jumlah adukan</span></label><input id="bm-mix" name="mixingCount" className="num" inputMode="decimal" defaultValue={initial.mixingCount} /></div>
          <div className="field"><label htmlFor="bm-leader">Leader produksi</label><input id="bm-leader" name="leader" defaultValue={initial.leader} maxLength={100} placeholder="Mis. Sumitra" /></div>
        </div>
        <div className="field">
          <span className="label">Status <span className="help">otomatis</span></span>
          <p><span className={`badge ${status === "sesuai" ? "badge-on" : "badge-warn"}`}>{CHECK_STATUS_LABELS[status]}</span> <span className="small muted">{status === "sesuai" ? "Takaran actual sama dengan yang disetujui." : "Ada takaran actual yang berbeda dari yang disetujui."}</span></p>
        </div>
        <div className="field">
          <label htmlFor="bm-notes">Catatan</label>
          <textarea id="bm-notes" name="notes" defaultValue={initial.notes} maxLength={2000} placeholder="Temuan, kendala, slump, cuaca, dll." />
        </div>
        <p className="small muted">Jumlah hasil produksi tetap diisi mandor di Hasil produksi (precast).</p>
      </section>
      <div className="form-actions">
        <SubmitButton>{initial.id ? "Simpan perubahan" : "Simpan"}</SubmitButton>
        <Link href={back} className="btn btn-ghost">Batal</Link>
      </div>
    </ActionForm>
  );
}

export type DowntimeInitial = { id?: string; workDate: string; area: string; startTime: string; endTime: string; hours: string; minutes: string; reasons: string[]; workersShort: string; note: string };

const diff = (a: string, b: string) => {
  if (!/^\d{2}:\d{2}$/.test(a) || !/^\d{2}:\d{2}$/.test(b)) return null;
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  const v = bh * 60 + bm - (ah * 60 + am);
  return v > 0 ? v : null;
};
const durText = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} jam${m % 60 ? ` ${m % 60} mnt` : ""}` : `${m} mnt`);

/** Catat / ubah waktu produksi terbuang. Lama dari jam mulai–selesai, atau diketik langsung. */
export function DowntimeForm({ initial, areas, issues, back }: { initial: DowntimeInitial; areas: string[]; issues: string[]; back: string }) {
  const [start, setStart] = useState(initial.startTime);
  const [end, setEnd] = useState(initial.endTime);
  const [hours, setHours] = useState(initial.hours);
  const [mins, setMins] = useState(initial.minutes);
  const [reasons, setReasons] = useState<string[]>(initial.reasons);
  const typed = (Number(hours) || 0) * 60 + (Number(mins) || 0);
  const total = typed > 0 ? typed : diff(start, end) ?? 0;
  const toggle = (r: string) => setReasons((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]));
  return (
    <ActionForm action={saveDowntime} className="stack" style={{ gap: 20 }}>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {reasons.map((r) => <input key={r} type="hidden" name="reasons" value={r} />)}
      <section className="form-section">
        <div className="form-grid">
          <div className="field"><label htmlFor="dt-date">Tanggal</label><DateField id="dt-date" name="workDate" defaultValue={initial.workDate} required /></div>
          <div className="field">
            <label htmlFor="dt-area">Area / produk yang terhenti</label>
            <select id="dt-area" name="area" defaultValue={initial.area || areas[0]}>
              {areas.map((a) => <option key={a}>{a}</option>)}
            </select>
          </div>
        </div>
      </section>
      <section className="form-section">
        <span className="label">Lama waktu terbuang</span>
        <div className="form-grid">
          <div className="field"><label htmlFor="dt-start">Dari jam</label><input id="dt-start" name="startTime" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div className="field"><label htmlFor="dt-end">Sampai jam</label><input id="dt-end" name="endTime" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        </div>
        <p className="small muted">atau isi langsung</p>
        <div className="form-grid">
          <div className="field"><label htmlFor="dt-h">Jam</label><input id="dt-h" name="hours" inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value.replace(/\D/g, ""))} placeholder="0" /></div>
          <div className="field"><label htmlFor="dt-m">Menit</label><input id="dt-m" name="minutes" inputMode="numeric" value={mins} onChange={(e) => setMins(e.target.value.replace(/\D/g, ""))} placeholder="0" /></div>
        </div>
        <p>Total: <b>{total ? durText(total) : "-"}</b></p>
      </section>
      <section className="form-section">
        <span className="label">Alasan <span className="help">boleh lebih dari satu</span></span>
        <div className="seg" role="group" aria-label="Alasan">
          {issues.map((r) => (
            <button key={r} type="button" className={`seg-opt${reasons.includes(r) ? " on" : ""}`} aria-pressed={reasons.includes(r)} onClick={() => toggle(r)}>{r}</button>
          ))}
        </div>
        {reasons.includes("Kurang tenaga kerja") && (
          <div className="field" style={{ maxWidth: 220 }}><label htmlFor="dt-ws">Pekerja yang kurang (orang)</label><input id="dt-ws" name="workersShort" inputMode="numeric" defaultValue={initial.workersShort} placeholder="Mis. 3" /></div>
        )}
        <div className="field"><label htmlFor="dt-note">Keterangan</label><textarea id="dt-note" name="note" defaultValue={initial.note} maxLength={1000} placeholder="Mis. mesin cetak genteng macet, menunggu teknisi; 2 pekerja izin" /></div>
      </section>
      <div className="form-actions">
        <SubmitButton>Simpan</SubmitButton>
        <Link href={back} className="btn btn-ghost">Batal</Link>
      </div>
    </ActionForm>
  );
}
