"use client";

import dynamic from "next/dynamic";
import type { LayoutResult } from "@/lib/paving/engine/types";
import type { ProjectGeometry } from "@/lib/paving/geometry/types";
import { DesignerErrorBoundary, retryImport } from "./DesignerErrorBoundary";
import { IconAlert } from "./Icons";
import css from "./PavingDesigner.module.css";
import { Preview2D } from "./Preview2D";

const DynamicPavingDesigner3D = dynamic(
  () => retryImport(() => import("./PavingDesigner3D").then((mod) => mod.PavingDesigner3D)),
  {
    ssr: false,
    loading: () => (
      <div className={css.loadingBox}>
        <p>Memuat visualisasi 3D lahan...</p>
      </div>
    ),
  },
);

export interface DynamicSitePreviewProps {
  geometry: ProjectGeometry | null;
  layout: LayoutResult | null;
  error: string | null;
  view3d: boolean;
  onSwitchTo2D: () => void;
  tebalCm: number;
  showKanstin: boolean;
  roleColors: string[];
}

export function DynamicSitePreview({
  geometry,
  layout,
  error,
  view3d,
  onSwitchTo2D,
  tebalCm,
  showKanstin,
  roleColors,
}: DynamicSitePreviewProps) {
  if (error) {
    return (
      <div className={css.errorAlert} role="alert">
        <IconAlert size={18} />
        <div>
          <strong>Kendala perhitungan lahan:</strong> {error}
        </div>
      </div>
    );
  }

  if (!geometry || !layout) {
    return (
      <div className={css.loadingBox}>
        <p>Menyiapkan tata letak potongan lahan...</p>
      </div>
    );
  }

  if (!view3d) {
    return <Preview2D geometry={geometry} layout={layout} roleColors={roleColors} />;
  }

  return (
    <DesignerErrorBoundary
      title="Visualisasi 3D tidak dapat dimuat"
      fallbackHint="Modul grafis 3D gagal diunduh atau dibatasi perangkat. Anda tetap dapat melihat denah potongan dan perhitungan penuh pada tampilan 2D."
      resetKey={`${geometry.metrics.areaM2}-${layout.metrics.fullCount}-${layout.metrics.partialCount}-${roleColors.join(",")}`}
      onFallbackAction={onSwitchTo2D}
      fallbackActionLabel="Kembali ke 2D Tampak Atas"
    >
      <DynamicPavingDesigner3D
        layout={layout}
        geometry={geometry}
        tebalCm={tebalCm}
        showKanstin={showKanstin}
        roleColors={roleColors}
        onSwitchTo2D={onSwitchTo2D}
      />
    </DesignerErrorBoundary>
  );
}

export default DynamicSitePreview;
