"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import type { SiteInputStatus } from "./site-status";

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
  /** Status masukan (menghitung/belum valid) agar induk tidak memakai hasil basi. */
  onStatusChange?: (status: SiteInputStatus) => void;
  rotationDeg: number;
  onRotationChange: (deg: number) => void;
  /** Bentuk awal dipulihkan dari tautan bagi; formulir bentuk siap pakai tidak boleh menimpanya. */
  holdInitial?: boolean;
}

export function DynamicSiteInput({
  geometry,
  onGeometryChange,
  onStatusChange,
  rotationDeg,
  onRotationChange,
  holdInitial,
}: DynamicSiteInputProps) {
  const [activeMethod, setActiveMethod] = useState<InputMethod>("preset");
  // Cara input yang pernah dibuka tetap terpasang (disembunyikan) supaya isiannya tidak hilang.
  const [visited, setVisited] = useState<ReadonlySet<InputMethod>>(() => new Set<InputMethod>(["preset"]));

  const activeRef = useRef(activeMethod);
  activeRef.current = activeMethod;
  const geomCbRef = useRef(onGeometryChange);
  geomCbRef.current = onGeometryChange;
  /** Geometri terakhir tiap cara input, dipasang ulang saat pengguna kembali ke cara itu. */
  const lastGeom = useRef<Partial<Record<InputMethod, ProjectGeometry>>>({});

  // Callback per cara input harus stabil (PresetForm memicu efek saat identitasnya berubah).
  const emit = useMemo(() => {
    const make = (method: InputMethod) => (geom: ProjectGeometry) => {
      lastGeom.current[method] = geom;
      if (activeRef.current === method) geomCbRef.current(geom);
    };
    return { preset: make("preset"), grid: make("grid"), map: make("map"), import: make("import") };
  }, []);

  const selectMethod = (method: InputMethod) => {
    setActiveMethod(method);
    setVisited((prev) => (prev.has(method) ? prev : new Set(prev).add(method)));
  };

  // Kembali ke cara input yang sudah punya hasil: pakai lagi bentuk terakhirnya.
  useEffect(() => {
    const g = lastGeom.current[activeMethod];
    if (g) geomCbRef.current(g);
  }, [activeMethod]);

  return (
    <div className={css.stack}>
      <InputMethodPicker activeMethod={activeMethod} onChange={selectMethod} />

      {visited.has("preset") && (
        <div hidden={activeMethod !== "preset"}>
          <PresetForm onGeometryChange={emit.preset} onStatusChange={onStatusChange} holdInitial={holdInitial} />
        </div>
      )}

      {visited.has("grid") && (
        <div hidden={activeMethod !== "grid"}>
          <GridCanvas onGeometryChange={emit.grid} onStatusChange={onStatusChange} />
        </div>
      )}

      {visited.has("map") && (
        <div hidden={activeMethod !== "map"}>
          <DesignerErrorBoundary
            title="Peta satelit tidak dapat dimuat"
            fallbackHint="Terjadi kendala saat mengunduh modul peta satelit. Anda dapat mencoba lagi atau beralih ke Bentuk Siap Pakai."
            resetKey={visited.has("map") ? "map" : ""}
            onFallbackAction={() => selectMethod("preset")}
            fallbackActionLabel="Gunakan Bentuk Siap Pakai"
          >
            <DynamicMapDrawer onApplyGeometry={emit.map} />
          </DesignerErrorBoundary>
        </div>
      )}

      {visited.has("import") && (
        <div hidden={activeMethod !== "import"}>
          <FileImportModal onApplyGeometry={emit.import} />
        </div>
      )}

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
