"use client";

import Link from "next/link";
import { useState } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { createStrengthTest, updateStrengthTest } from "@/app/operasional/actions/qc";
import { DateField } from "@/components/ui";
import { parseQty, today } from "@/lib/erp/util";
import { evaluateSample, standardTable, STANDARD_AREA_CM2 } from "@/lib/ops/shared/strength";
import { fromRows, qnum, toRows } from "./labels";
import { MaterialEditor } from "./MaterialEditor";
import { emptySample as blankSample, type SampleInitial, type StrengthInitial } from "./strengthInit";
import "./qc.css";

const MAX_SAMPLES = 50;
const pn = (v: string) => (v.trim() === "" ? null : parseQty(v));
const emptySample = (prev?: SampleInitial) => blankSample(today(), prev);

/** Buat / ubah laporan "Hasil Uji Kuat Tekan Beton". Umur, kekuatan, dan target dihitung otomatis saat mengetik. */
export function StrengthForm({ initial, back }: { initial: StrengthInitial; back: string }) {
  const [grade, setGrade] = useState(initial.concreteGrade);
  const [samples, setSamples] = useState<SampleInitial[]>(initial.samples.length ? initial.samples : [emptySample()]);
  const [comp, setComp] = useState(() => toRows(initial.composition));
  const set = (i: number, patch: Partial<SampleInitial>) => setSamples((rows) => rows.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const standard = standardTable(grade, pn(samples[0]?.areaCm2 ?? "") ?? STANDARD_AREA_CM2);

  return (
    <ActionForm action={initial.id ? updateStrengthTest : createStrengthTest} className="stack" style={{ gap: 20 }}>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="samples" value={JSON.stringify(samples)} />
      <input type="hidden" name="composition" value={JSON.stringify(fromRows(comp))} />
      <section className="form-section">
        <p className="small muted">Kekuatan (kg/cm²) = tekanan maksimum (kN) × 101,97 ÷ luas bidang (cm²). Target mengikuti mutu beton dan umur benda uji.</p>
        <div className="form-grid cols-4">
          <div className="field"><label htmlFor="st-date">Tanggal laporan</label><DateField id="st-date" name="reportDate" defaultValue={initial.reportDate} required /></div>
          <div className="field"><label htmlFor="st-grade">Mutu beton</label><input id="st-grade" name="concreteGrade" value={grade} onChange={(e) => setGrade(e.target.value)} required maxLength={30} placeholder="K-350" /></div>
          <div className="field span-2"><label htmlFor="st-to">Tertuju</label><input id="st-to" name="addressedTo" defaultValue={initial.addressedTo} maxLength={200} /></div>
          <div className="field span-2"><label htmlFor="st-company">Nama perusahaan</label><input id="st-company" name="companyName" defaultValue={initial.companyName} maxLength={200} /></div>
          <div className="field span-2"><label htmlFor="st-address">Alamat</label><input id="st-address" name="address" defaultValue={initial.address} maxLength={500} /></div>
        </div>
      </section>

      <section className="form-section">
        <div className="card-head" style={{ marginBottom: 0 }}><h2>Benda uji</h2><span className="small muted">maksimal {MAX_SAMPLES}</span></div>
        <div className="qc-samples">
          {samples.map((s, i) => {
            const r = evaluateSample(grade, { madeAt: s.madeAt || null, testedAt: s.testedAt || null, maxLoadKn: pn(s.maxLoadKn), areaCm2: pn(s.areaCm2) });
            return (
              <div className="qc-sample" key={i}>
                <div className="field qc-s-name"><label htmlFor={`s-name-${i}`}>Benda uji {i + 1}</label><input id={`s-name-${i}`} value={s.sampleName} onChange={(e) => set(i, { sampleName: e.target.value })} placeholder="Paving 6 cm" maxLength={100} /></div>
                <div className="field"><label htmlFor={`s-made-${i}`}>Tgl pembuatan</label><DateField id={`s-made-${i}`} value={s.madeAt} onChange={(v) => set(i, { madeAt: v })} /></div>
                <div className="field"><label htmlFor={`s-test-${i}`}>Tgl ditest</label><DateField id={`s-test-${i}`} value={s.testedAt} onChange={(v) => set(i, { testedAt: v })} /></div>
                <div className="field"><label htmlFor={`s-w-${i}`}>Berat (kg)</label><input id={`s-w-${i}`} className="num" inputMode="decimal" value={s.weightKg} onChange={(e) => set(i, { weightKg: e.target.value })} /></div>
                <div className="field"><label htmlFor={`s-a-${i}`}>Luas (cm²)</label><input id={`s-a-${i}`} className="num" inputMode="decimal" value={s.areaCm2} onChange={(e) => set(i, { areaCm2: e.target.value })} /></div>
                <div className="field"><label htmlFor={`s-k-${i}`}>Tekanan (kN)</label><input id={`s-k-${i}`} className="num" inputMode="decimal" value={s.maxLoadKn} onChange={(e) => set(i, { maxLoadKn: e.target.value })} /></div>
                <div className="qc-calc" aria-live="polite">
                  <span>Umur <b>{r.ageDays ?? "-"}</b> hari</span>
                  <span>Kekuatan <b className={r.passed === null ? "" : r.passed ? "text-sukses" : "text-bahaya"}>{qnum(r.strength) || "-"}</b></span>
                  <span>Target <b>{qnum(r.target) || "-"}</b></span>
                  <button type="button" className="icon-btn" aria-label={`Hapus benda uji ${i + 1}`} onClick={() => setSamples((rows) => (rows.length > 1 ? rows.filter((_, j) => j !== i) : [emptySample()]))}>×</button>
                </div>
              </div>
            );
          })}
        </div>
        <div>
          <button type="button" className="btn btn-ghost btn-sm" disabled={samples.length >= MAX_SAMPLES} onClick={() => setSamples((rows) => [...rows, emptySample(rows[rows.length - 1])])}>+ Tambah benda uji</button>
        </div>
      </section>

      <div className="form-grid">
        <section className="form-section">
          <h2>Catatan komposisi campuran</h2>
          <MaterialEditor label="Komposisi" items={comp} onChange={setComp} />
        </section>
        <section className="form-section">
          <h2>Standarisasi {grade || "-"}</h2>
          <table className="compact qc-standard">
            <thead><tr><th>Umur</th><th className="num">Tekanan maks (kN)</th><th className="num">Kekuatan (kg/cm²)</th></tr></thead>
            <tbody>
              {standard.map((row) => (
                <tr key={row.days}><td>{row.days} hari</td><td className="num">{qnum(row.maxLoadKn)}</td><td className="num">{qnum(row.strength)}</td></tr>
              ))}
              {!standard.length && <tr><td colSpan={3} className="muted">Isi mutu beton, mis. K-350.</td></tr>}
            </tbody>
          </table>
          <div className="field"><label htmlFor="st-notes">Note</label><textarea id="st-notes" name="notes" defaultValue={initial.notes} maxLength={2000} /></div>
        </section>
      </div>

      <div className="form-actions">
        <SubmitButton>{initial.id ? "Simpan perubahan" : "Simpan laporan"}</SubmitButton>
        <Link href={back} className="btn btn-ghost">Batal</Link>
      </div>
    </ActionForm>
  );
}
