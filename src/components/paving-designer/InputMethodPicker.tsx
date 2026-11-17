"use client";

import css from "./PavingDesigner.module.css";

export type InputMethod = "preset" | "grid" | "map" | "import";

interface Props {
  activeMethod: InputMethod;
  onChange: (method: InputMethod) => void;
}

export function InputMethodPicker({ activeMethod, onChange }: Props) {
  return (
    <div className={css.tabs} role="tablist" aria-label="Metode Masukan Lahan">
      <button
        type="button"
        role="tab"
        aria-selected={activeMethod === "preset"}
        className={`${css.tabBtn} ${activeMethod === "preset" ? css.tabActive : ""}`}
        onClick={() => onChange("preset")}
      >
        <span>📐</span>
        <span>Bentuk Siap Pakai</span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={activeMethod === "grid"}
        className={`${css.tabBtn} ${activeMethod === "grid" ? css.tabActive : ""}`}
        onClick={() => onChange("grid")}
      >
        <span>✏️</span>
        <span>Gambar di Grid</span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={activeMethod === "map"}
        className={`${css.tabBtn} ${activeMethod === "map" ? css.tabActive : ""}`}
        onClick={() => onChange("map")}
      >
        <span>🛰️</span>
        <span>Peta Satelit</span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={activeMethod === "import"}
        className={`${css.tabBtn} ${activeMethod === "import" ? css.tabActive : ""}`}
        onClick={() => onChange("import")}
      >
        <span>📁</span>
        <span>Impor GeoJSON/KML</span>
      </button>
    </div>
  );
}
