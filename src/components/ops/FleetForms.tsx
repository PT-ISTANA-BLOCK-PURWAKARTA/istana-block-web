"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { DateField } from "@/components/ui";
import { saveDriver, saveVehicle } from "@/app/operasional/actions/fleet";

type Vehicle = { id: string; plate: string; name: string; capacity: string; note: string; active: boolean; gpsDeviceId: string | null; stnkExpiry: string | null; kirExpiry: string | null };
type Driver = { id: string; name: string; phone: string; note: string; active: boolean; licenseNo: string | null; licenseExpiry: string | null };

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
        <div className="field"><label htmlFor="vh-gps">ID perangkat GPS <span className="help">IMEI / ID yang dikirim alat GPS atau aplikasi pelacak; kosongkan bila belum ada</span></label><input id="vh-gps" name="gpsDeviceId" defaultValue={v?.gpsDeviceId ?? ""} placeholder="mis. 864895031234567" autoComplete="off" /></div>
        <div className="field"><label htmlFor="vh-stnk">Masa berlaku STNK <span className="help">opsional, diingatkan 30 hari sebelumnya</span></label><DateField id="vh-stnk" name="stnkExpiry" defaultValue={v?.stnkExpiry ?? ""} /></div>
        <div className="field"><label htmlFor="vh-kir">Masa berlaku KIR <span className="help">opsional, diingatkan 30 hari sebelumnya</span></label><DateField id="vh-kir" name="kirExpiry" defaultValue={v?.kirExpiry ?? ""} /></div>
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
        <div className="field"><label htmlFor="dr-sim">Nomor SIM <span className="help">opsional</span></label><input id="dr-sim" name="licenseNo" defaultValue={d?.licenseNo ?? ""} autoComplete="off" /></div>
        <div className="field"><label htmlFor="dr-sim-exp">Masa berlaku SIM <span className="help">opsional, diingatkan 30 hari sebelumnya</span></label><DateField id="dr-sim-exp" name="licenseExpiry" defaultValue={d?.licenseExpiry ?? ""} /></div>
        <div className="field full"><label htmlFor="dr-note">Catatan <span className="help">opsional</span></label><input id="dr-note" name="note" defaultValue={d?.note} /></div>
        {d && <label className="check"><input type="checkbox" name="active" defaultChecked={d.active} /> Aktif</label>}
      </div>
      <div><SubmitButton>{d ? "Simpan" : "Tambah"}</SubmitButton></div>
    </ActionForm>
  );
}
