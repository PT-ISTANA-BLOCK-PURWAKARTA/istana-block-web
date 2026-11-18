"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { DesignerErrorBoundary, retryImport } from "./DesignerErrorBoundary";
import type { PavingDesigner as PavingDesignerComponent } from "./PavingDesigner";

const DynamicPavingDesigner = dynamic<ComponentProps<typeof PavingDesignerComponent>>(
  () => retryImport(() => import("./PavingDesigner").then((mod) => mod.PavingDesigner)),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          minHeight: "180px",
          display: "grid",
          placeItems: "center",
          background: "#fff",
          borderRadius: "28px",
          color: "var(--redup)",
          fontWeight: 600,
        }}
      >
        Menyiapkan Kalkulator Lahan Dinamis...
      </div>
    ),
  },
);

export function PavingDesigner(props: ComponentProps<typeof PavingDesignerComponent>) {
  return (
    <DesignerErrorBoundary
      title="Kalkulator Lahan Dinamis tidak dapat dimuat"
      fallbackHint="Terjadi gangguan jaringan saat mengunduh modul desainer lahan. Klik Muat Ulang Halaman untuk mencoba kembali."
    >
      <DynamicPavingDesigner {...props} />
    </DesignerErrorBoundary>
  );
}

export default PavingDesigner;
