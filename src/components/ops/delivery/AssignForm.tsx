"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { assignDelivery } from "@/app/operasional/actions/deliveries";
import { Select } from "@/components/ui";

/** Ganti sopir/armada surat jalan yang belum berangkat. Sopir baru dan sopir lama (dialihkan) menerima push. */
export function AssignForm({
  id,
  vehicleId,
  driverId,
  vehicles,
  drivers,
}: {
  id: string;
  vehicleId: string | null;
  driverId: string | null;
  vehicles: { id: string; plate: string; name: string }[];
  drivers: { id: string; name: string }[];
}) {
  return (
    <details className="form-details">
      <summary>Ganti sopir / armada</summary>
      <ActionForm action={assignDelivery} className="stack" style={{ gap: 10, paddingTop: 10 }}>
        <input type="hidden" name="id" value={id} />
        <div className="form-grid">
          <div className="field">
            <label htmlFor="as-vehicle">Kendaraan</label>
            <Select id="as-vehicle" name="vehicleId" defaultValue={vehicleId ?? ""} placeholder="Belum ditentukan" options={[{ value: "", label: "Belum ditentukan" }, ...vehicles.map((v) => ({ value: v.id, label: v.plate, hint: v.name || undefined }))]} />
          </div>
          <div className="field">
            <label htmlFor="as-driver">Sopir</label>
            <Select id="as-driver" name="driverId" defaultValue={driverId ?? ""} placeholder="Belum ditentukan" options={[{ value: "", label: "Belum ditentukan" }, ...drivers.map((d) => ({ value: d.id, label: d.name }))]} />
          </div>
        </div>
        <div><SubmitButton className="btn btn-blue btn-sm">Simpan penugasan</SubmitButton></div>
      </ActionForm>
    </details>
  );
}
