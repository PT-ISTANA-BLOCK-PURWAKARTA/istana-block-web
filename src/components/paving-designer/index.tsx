"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { PavingDesigner as PavingDesignerComponent } from "./PavingDesigner";

export const PavingDesigner = dynamic<ComponentProps<typeof PavingDesignerComponent>>(
  () => import("./PavingDesigner").then((mod) => mod.PavingDesigner),
  {
    ssr: false,
    loading: () => (
      <div style={{ minHeight: "160px", display: "grid", placeItems: "center", color: "var(--redup)" }}>
        Menyiapkan Desainer Lahan...
      </div>
    ),
  },
);

export default PavingDesigner;
