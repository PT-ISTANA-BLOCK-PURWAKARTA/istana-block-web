"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { ProjectGeometry } from "@/lib/paving/geometry/types";
import type { ProductId } from "@/lib/paving/legacy/types";
import { MAX_3D_BLOCKS } from "@/lib/paving/render/lattice-texture";
import { unpackLayout, type PackedLayoutResult } from "@/lib/paving/render/packed-tiles";
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
  layout: PackedLayoutResult | null;
  error: string | null;
  view3d: boolean;
  onSwitchTo2D: () => void;
  tebalCm: number;
  showKanstin: boolean;
  roleColors: string[];
  productId: ProductId;
  motifId: string;
  rotationDeg: number;
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
  productId,
  motifId,
  rotationDeg,
}: DynamicSitePreviewProps) {
  // Pratinjau 3D per keping butuh objek keping; dibuat hanya saat 3D dipilih dan lahan <= MAX_3D_BLOCKS.
  // Lahan lebih besar tidak pernah dibuka bungkusnya: 3D memakai poligon lahan + tekstur pola.
  const layout3d = useMemo(
    () => (view3d && layout && layout.packed.count <= MAX_3D_BLOCKS ? unpackLayout(layout) : null),
    [view3d, layout],
  );

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
    return (
      <Preview2D
        geometry={geometry}
        layout={layout}
        roleColors={roleColors}
        productId={productId}
        motifId={motifId}
        rotationDeg={rotationDeg}
      />
    );
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
        layout={layout3d}
        metrics={layout.metrics}
        productId={productId}
        motifId={motifId}
        rotationDeg={rotationDeg}
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
