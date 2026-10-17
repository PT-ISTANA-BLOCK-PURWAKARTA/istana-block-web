"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { saveDriver, saveVehicle } from "@/app/operasional/actions/fleet";

type Vehicle = { id: string; plate: string; name: string; capacity: string; note: string; active: boolean };
type Driver = { id: string; name: string; phone: string; note: string; active: boolean };

export function VehicleForm({ v }: { v?: Vehicle }) {
  return (
    <ActionForm action={saveVehicle} className="form-section">
      {v && <input type="hidden" name="id" value={v.id} />}
      <h2>{v ? "Ubah kendaraan" : "Tambah kendaraan"}</h2>
      <div className="form-grid">
        <div className="field"><label htmlFor="vh-plate">Nomor polisi</label><input id="vh-plate" name="plate" defaultValue={v?.plate} required placeholder="T 1234 AB" /></div>
        <div className="field"><label htmlFor="vh-name">Jenis / nama <span className="help">opsional</span></label><input id="vh-name" name="name" defaultValue={v?.name} placeholder="mis. Colt diesel bak" /></div>
        <div className="field"><label htmlFor="vh-cap">Kapasitas <span className="help">opsional</span></label><input id="vh-cap" name="capacity" defaultValue={v?.capacity} placeholder="mis. ± 60 m² paving / 4 ton" /></div>
        <div className="field"><label htmlFor="vh-note">Catatan <span className="help">opsional</span></label><input id="vh-note" name="note" defaultValue={v?.note} /></div>
        {v && <label className="check"><input type="checkbox" name="active" defaultChecked={v.active} /> Aktif</label>}
      </div>
      <div><SubmitButton>{v ? "Simpan" : "Tambah"}</SubmitButton></div>
    </ActionForm>
  );
}

export function DriverForm({ d }: { d?: Driver }) {
  return (
    <ActionForm action={saveDriver} className="form-section">
      {d && <input type="hidden" name="id" value={d.id} />}
      <h2>{d ? "Ubah sopir" : "Tambah sopir"}</h2>
      <div className="form-grid">
        <div className="field"><label htmlFor="dr-name">Nama</label><input id="dr-name" name="name" defaultValue={d?.name} required minLength={2} /></div>
        <div className="field"><label htmlFor="dr-phone">Telepon / WhatsApp</label><input id="dr-phone" name="phone" type="tel" defaultValue={d?.phone} /></div>
        <div className="field full"><label htmlFor="dr-note">Catatan <span className="help">opsional, mis. nomor SIM</span></label><input id="dr-note" name="note" defaultValue={d?.note} /></div>
        {d && <label className="check"><input type="checkbox" name="active" defaultChecked={d.active} /> Aktif</label>}
      </div>
      <div><SubmitButton>{d ? "Simpan" : "Tambah"}</SubmitButton></div>
    </ActionForm>
  );
}
