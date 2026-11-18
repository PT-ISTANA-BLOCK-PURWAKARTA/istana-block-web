"use client";

import { IconGrid, IconMap, IconPreset, IconUpload } from "./Icons";
import css from "./PavingDesigner.module.css";

export type InputMethod = "preset" | "grid" | "map" | "import";

interface Props {
  activeMethod: InputMethod;
  onChange: (method: InputMethod) => void;
}

const METHODS: Array<{ id: InputMethod; label: string; Icon: typeof IconPreset }> = [
  { id: "preset", label: "Bentuk Siap Pakai", Icon: IconPreset },
  { id: "grid", label: "Gambar di Grid", Icon: IconGrid },
  { id: "map", label: "Peta Satelit", Icon: IconMap },
  { id: "import", label: "Impor GeoJSON / KML", Icon: IconUpload },
];

export function InputMethodPicker({ activeMethod, onChange }: Props) {
  return (
    <div className={css.methodBar} role="tablist" aria-label="Metode masukan bentuk lahan">
      {METHODS.map(({ id, label, Icon }) => {
        const active = activeMethod === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`${css.methodBtn} ${active ? css.methodActive : ""}`}
            onClick={() => onChange(id)}
          >
            <Icon size={17} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
