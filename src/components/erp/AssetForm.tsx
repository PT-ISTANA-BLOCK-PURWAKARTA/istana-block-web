"use client";

// Form harta tetap (gaya Zahir): kelompok mengisi rekening & umur bawaan, lalu bisa diubah.
import { useState } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Select } from "@/components/ui";
import { saveAsset } from "@/app/akuntansi/actions/assets";
import type { AssetCategory, DepreciationMethod } from "@/db/erp";

type Opt = { value: string; label: string };
export type AssetFormValue = {
  id?: string; code?: string; name?: string; category?: AssetCategory; method?: DepreciationMethod;
  assetAccountId?: string; accumAccountId?: string | null; expenseAccountId?: string | null;
  acquiredDate?: string; startDate?: string; cost?: number; salvage?: number; lifeMonths?: number;
  openingAccum?: number; openingDate?: string | null; location?: string; note?: string;
};

export function AssetForm({ a, categories, methods, defaults, assetAccounts, accumAccounts, expenseAccounts, locked }: {
  a?: AssetFormValue;
  categories: Opt[];
  methods: Opt[];
  defaults: Record<string, { asset?: string; accum?: string; expense?: string; lifeMonths: number }>;
  assetAccounts: Opt[];
  accumAccounts: Opt[];
  expenseAccounts: Opt[];
  locked?: boolean;
}) {
  const [cat, setCat] = useState<string>(a?.category ?? "mesin");
  const d = defaults[cat];
  const [key, setKey] = useState(0);
  const life = a?.lifeMonths ?? d?.lifeMonths ?? 0;
  return (
    <ActionForm action={saveAsset} className="stack" style={{ gap: 20 }}>
      {a?.id && <input type="hidden" name="id" value={a.id} />}
      <section className="form-section">
        <h2 className="form-h">Data aset</h2>
        <div className="form-grid">
          <div className="field"><label htmlFor="as-code">Kode aset</label><input id="as-code" name="code" defaultValue={a?.code} required placeholder="mis. KND-01" /></div>
          <div className="field">
            <label htmlFor="as-cat">Kelompok</label>
            <Select id="as-cat" name="category" defaultValue={cat} options={categories} onChange={(v) => { setCat(String(v)); setKey((k) => k + 1); }} />
          </div>
          <div className="field full"><label htmlFor="as-name">Nama aset</label><input id="as-name" name="name" defaultValue={a?.name} required placeholder="mis. Truk Colt Diesel B 9526 S" /></div>
          <div className="field"><label htmlFor="as-date">Tanggal perolehan</label><input id="as-date" type="date" name="acquiredDate" defaultValue={a?.acquiredDate} required /></div>
          <div className="field"><label htmlFor="as-loc">Lokasi / pemakai</label><input id="as-loc" name="location" defaultValue={a?.location} placeholder="mis. Pabrik Pasawahan" /></div>
          <div className="field"><label htmlFor="as-cost">Harga perolehan (Rp)</label><input id="as-cost" name="cost" inputMode="numeric" defaultValue={a?.cost ?? ""} required readOnly={locked} /></div>
          <div className="field"><label htmlFor="as-salv">Nilai sisa (Rp)</label><input id="as-salv" name="salvage" inputMode="numeric" defaultValue={a?.salvage ?? 0} /></div>
        </div>
      </section>
      <section className="form-section" key={key}>
        <h2 className="form-h">Penyusutan</h2>
        <div className="form-grid">
          <div className="field"><label htmlFor="as-method">Metode</label><Select id="as-method" name="method" defaultValue={a?.method ?? (cat === "tanah" ? "tidak_disusutkan" : "garis_lurus")} options={methods} /></div>
          <div className="field"><label htmlFor="as-start">Mulai disusutkan (bulan)</label><input id="as-start" type="month" name="startMonth" defaultValue={a?.startDate?.slice(0, 7)} /></div>
          <div className="field"><label htmlFor="as-life">Umur ekonomis (tahun)</label><input id="as-life" name="lifeYears" inputMode="decimal" defaultValue={life ? String(Math.floor(life / 12)) : ""} /></div>
          <div className="field"><label htmlFor="as-lifem">+ bulan</label><input id="as-lifem" name="lifeExtraMonths" inputMode="numeric" defaultValue={life % 12 || ""} /></div>
          <div className="field"><label htmlFor="as-acc">Rekening aset</label><Select id="as-acc" name="assetAccountId" defaultValue={a?.assetAccountId ?? d?.asset ?? ""} searchable options={assetAccounts} /></div>
          <div className="field"><label htmlFor="as-accum">Rekening akumulasi penyusutan</label><Select id="as-accum" name="accumAccountId" defaultValue={a?.accumAccountId ?? d?.accum ?? ""} searchable options={[{ value: "", label: "(tidak ada)" }, ...accumAccounts]} /></div>
          <div className="field full"><label htmlFor="as-exp">Rekening beban penyusutan</label><Select id="as-exp" name="expenseAccountId" defaultValue={a?.expenseAccountId ?? d?.expense ?? ""} searchable options={[{ value: "", label: "(tidak ada)" }, ...expenseAccounts]} /></div>
        </div>
      </section>
      <section className="form-section">
        <h2 className="form-h">Akumulasi sebelum dicatat di web <span className="help">mis. penyusutan yang sudah dibukukan di Zahir</span></h2>
        <div className="form-grid">
          <div className="field"><label htmlFor="as-oa">Akumulasi penyusutan awal (Rp)</label><input id="as-oa" name="openingAccum" inputMode="numeric" defaultValue={a?.openingAccum ?? 0} readOnly={locked} /></div>
          <div className="field"><label htmlFor="as-od">Per tanggal</label><input id="as-od" type="date" name="openingDate" defaultValue={a?.openingDate ?? ""} /></div>
          <div className="field full"><label htmlFor="as-note">Catatan</label><input id="as-note" name="note" defaultValue={a?.note} /></div>
        </div>
        {locked && <p className="help">Harga perolehan dan akumulasi awal dikunci karena sudah ada penyusutan yang dibukukan.</p>}
      </section>
      <div className="form-actions"><SubmitButton>{a?.id ? "Simpan perubahan" : "Simpan aset"}</SubmitButton></div>
    </ActionForm>
  );
}
