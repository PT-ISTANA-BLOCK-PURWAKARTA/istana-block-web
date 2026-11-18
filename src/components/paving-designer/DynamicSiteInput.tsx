"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { ProjectGeometry } from "@/lib/paving/geometry/types";
import { DesignerErrorBoundary, retryImport } from "./DesignerErrorBoundary";
import { FileImportModal } from "./FileImportModal";
import { GridCanvas } from "./GridCanvas";
import { IconBook } from "./Icons";
import { InputMethodPicker, type InputMethod } from "./InputMethodPicker";
import css from "./PavingDesigner.module.css";
import { PresetForm } from "./PresetForm";

const DynamicMapDrawer = dynamic(
  () => retryImport(() => import("./MapDrawer").then((mod) => mod.MapDrawer)),
  {
    ssr: false,
    loading: () => (
      <div className={css.loadingBox}>
        <p>Memuat modul peta satelit interaktif...</p>
      </div>
    ),
  },
);

const ROTATION_OPTIONS = [
  { v: 0, label: "Lurus (0°)" },
  { v: 45, label: "Miring Diagonal (45°)" },
];

export interface DynamicSiteInputProps {
  geometry: ProjectGeometry | null;
  onGeometryChange: (geom: ProjectGeometry) => void;
  rotationDeg: number;
  onRotationChange: (deg: number) => void;
}

export function DynamicSiteInput({
  geometry,
  onGeometryChange,
  rotationDeg,
  onRotationChange,
}: DynamicSiteInputProps) {
  const [activeMethod, setActiveMethod] = useState<InputMethod>("preset");

  return (
    <div className={css.stack}>
      <InputMethodPicker activeMethod={activeMethod} onChange={setActiveMethod} />

      {activeMethod === "preset" && <PresetForm onGeometryChange={onGeometryChange} />}

      {activeMethod === "grid" && <GridCanvas onGeometryChange={onGeometryChange} />}

      {activeMethod === "map" && (
        <DesignerErrorBoundary
          title="Peta satelit tidak dapat dimuat"
          fallbackHint="Terjadi kendala saat mengunduh modul peta satelit. Anda dapat mencoba lagi atau beralih ke Bentuk Siap Pakai."
          resetKey={activeMethod}
          onFallbackAction={() => setActiveMethod("preset")}
          fallbackActionLabel="Gunakan Bentuk Siap Pakai"
        >
          <DynamicMapDrawer onApplyGeometry={onGeometryChange} />
        </DesignerErrorBoundary>
      )}

      {activeMethod === "import" && <FileImportModal onApplyGeometry={onGeometryChange} />}

      <div className={css.field}>
        <span className={css.label}>Kemiringan pola terhadap lahan</span>
        <div className={css.segGroup} role="radiogroup" aria-label="Kemiringan pola terhadap lahan">
          {ROTATION_OPTIONS.map((opt) => (
            <button
              key={opt.v}
              type="button"
              role="radio"
              aria-checked={rotationDeg === opt.v}
              className={`${css.segPill} ${rotationDeg === opt.v ? css.segPillActive : ""}`}
              onClick={() => onRotationChange(opt.v)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {geometry && (
        <div className={css.mapToolbar}>
          <div className={css.mapInfo}>
            <span>
              Luas bersih: <strong>{geometry.metrics.areaM2.toLocaleString("id-ID", { maximumFractionDigits: 1 })} m²</strong>
            </span>
            <span className={css.divider}>·</span>
            <span>
              Keliling batas: <strong>{geometry.metrics.perimeterM.toLocaleString("id-ID", { maximumFractionDigits: 1 })} m</strong>
            </span>
          </div>
          <Link href="/panduan-desain-paving" className={css.guideInlineLink}>
            <IconBook size={15} />
            <span>Panduan ukur &amp; impor KML/GeoJSON →</span>
          </Link>
        </div>
      )}
    </div>
  );
}

export default DynamicSiteInput;
