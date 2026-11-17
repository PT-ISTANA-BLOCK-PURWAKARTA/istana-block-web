"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { PAVING_CATALOG, PRODUCT_LIST } from "@/lib/paving/catalog";
import { createRectanglePreset } from "@/lib/paving/adapters/preset";
import { calculateMaterialEstimate } from "@/lib/paving/engine/estimate";
import { generateLayout } from "@/lib/paving/engine/layout";
import type { PatternConfig } from "@/lib/paving/engine/types";
import type { ProjectGeometry } from "@/lib/paving/geometry/types";
import { PRODUCTS, type ProductId } from "@/lib/paving/legacy";
import { EstimatePanel } from "./EstimatePanel";
import { FileImportModal } from "./FileImportModal";
import { GridCanvas } from "./GridCanvas";
import { InputMethodPicker, type InputMethod } from "./InputMethodPicker";
import css from "./PavingDesigner.module.css";
import { PresetForm } from "./PresetForm";
import { Preview2D } from "./Preview2D";

const DynamicMapDrawer = dynamic(
  () => import("./MapDrawer").then((mod) => mod.MapDrawer),
  {
    ssr: false,
    loading: () => (
      <div className={css.loadingBox}>
        <p>Memuat modul peta satelit interaktif...</p>
      </div>
    ),
  },
);

interface Props {
  whatsapp: string;
}

export function PavingDesigner({ whatsapp }: Props) {
  const [activeMethod, setActiveMethod] = useState<InputMethod>("preset");

  // Default initial geometry: 10 x 5 meter rectangle
  const [geometry, setGeometry] = useState<ProjectGeometry>(() => createRectanglePreset(10, 5));

  // Pattern configuration state
  const [productId, setProductId] = useState<ProductId>("truepave");
  const [motifId, setMotifId] = useState<string>("bata");
  const [reservePercent, setReservePercent] = useState<number>(5);
  const [rotationDeg, setRotationDeg] = useState<number>(0);

  const productSpec = PAVING_CATALOG[productId];
  const productData = PRODUCTS[productId];
  const motifs = useMemo(() => {
    return productData?.motifs || [];
  }, [productData]);

  const config: PatternConfig = useMemo(
    () => ({
      productId,
      motifId,
      thicknessM: productSpec.tebalCm[0] / 100,
      reservePercent,
      rotationDeg,
      originM: { x: 0, y: 0 },
    }),
    [productId, motifId, productSpec, reservePercent, rotationDeg],
  );

  // Compute Layout & Material Estimate
  const { layout, estimate, error } = useMemo(() => {
    try {
      const lay = generateLayout(geometry, config);
      const est = calculateMaterialEstimate(lay, config, {
        perimeterM: geometry.metrics.perimeterM,
        includeAbuBatu: true,
        includeBaseCourse: true,
      });
      return { layout: lay, estimate: est, error: null };
    } catch (err: any) {
      return { layout: null, estimate: null, error: err?.message || "Gagal memproses layout." };
    }
  }, [geometry, config]);

  const handleProductChange = (newProd: ProductId) => {
    setProductId(newProd);
    const prod = PRODUCTS[newProd];
    if (prod && prod.motifs.length > 0) {
      setMotifId(prod.motifs[0].id);
    }
  };

  return (
    <section className={css.container} aria-label="Desainer Tata Letak Paving Sesuai Lahan">
      <div className={css.introCard}>
        <h2 className={css.introTitle}>📐 Desain & Potongan Paving Sesuai Bentuk Lahan</h2>
        <p className={css.introText}>
          Tentukan batas lahan Anda (persegi, bentuk L, U, atau gambar manual). Sistem memotong kepingan
          paving secara geometris murni, menghitung jumlah blok utuh, potongan batas, dan rekomendasi pembelian
          aman.
        </p>

        <div style={{ marginTop: "14px" }}>
          <InputMethodPicker activeMethod={activeMethod} onChange={setActiveMethod} />
        </div>
      </div>

      <div className={css.workspace}>
        {/* Left Column: Input Form & Pattern Settings */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Active Input Method Container */}
          <div className={css.panel}>
            <div className={css.panelHeader}>
              <h3 className={css.panelTitle}>1. Tentukan Bentuk & Dimensi Lahan</h3>
              <span className={css.badge}>
                Luas: {geometry.metrics.areaM2.toFixed(1)} m²
              </span>
            </div>

            {activeMethod === "preset" && <PresetForm onGeometryChange={setGeometry} />}

            {activeMethod === "grid" && <GridCanvas onGeometryChange={setGeometry} />}

            {activeMethod === "map" && <DynamicMapDrawer onApplyGeometry={setGeometry} />}

            {activeMethod === "import" && <FileImportModal onApplyGeometry={setGeometry} />}
          </div>

          {/* Pattern & Product Configuration */}
          <div className={css.panel}>
            <div className={css.panelHeader}>
              <h3 className={css.panelTitle}>2. Pilihan Paving & Pola Pemasangan</h3>
            </div>

            <div className={css.formGrid}>
              <div className={css.field}>
                <label className={css.label} htmlFor="pd-product">
                  Jenis Paving
                </label>
                <select
                  id="pd-product"
                  className={css.select}
                  value={productId}
                  onChange={(e) => handleProductChange(e.target.value as ProductId)}
                >
                  {PRODUCT_LIST.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sizeLabel})
                    </option>
                  ))}
                </select>
              </div>

              <div className={css.field}>
                <label className={css.label} htmlFor="pd-motif">
                  Motif Pasang
                </label>
                <select
                  id="pd-motif"
                  className={css.select}
                  value={motifId}
                  onChange={(e) => setMotifId(e.target.value)}
                >
                  {motifs.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={css.field}>
                <label className={css.label} htmlFor="pd-cad">
                  Cadangan Potong
                </label>
                <select
                  id="pd-cad"
                  className={css.select}
                  value={reservePercent}
                  onChange={(e) => setReservePercent(Number(e.target.value))}
                >
                  <option value={0}>0% (Tanpa Cadangan)</option>
                  <option value={3}>3% (Minimal)</option>
                  <option value={5}>5% (Disarankan Pola Lurus)</option>
                  <option value={10}>10% (Disarankan Hexagon/45°)</option>
                </select>
              </div>

              <div className={css.field}>
                <label className={css.label} htmlFor="pd-rot">
                  Kemiringan Pola
                </label>
                <select
                  id="pd-rot"
                  className={css.select}
                  value={rotationDeg}
                  onChange={(e) => setRotationDeg(Number(e.target.value))}
                >
                  <option value={0}>Lurus Tegak (0°)</option>
                  <option value={45}>Miring Diagonal (45°)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: 2D Visualizer & Material Estimate */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {error ? (
            <div className={css.panel}>
              <div className={css.badgeWarning} style={{ padding: "16px", borderRadius: "12px" }}>
                ❌ <strong>Terjadi Kendala:</strong> {error}
              </div>
            </div>
          ) : (
            layout && (
              <>
                <Preview2D geometry={geometry} layout={layout} />
                {estimate && (
                  <EstimatePanel
                    estimate={estimate}
                    config={config}
                    geometry={geometry}
                    whatsapp={whatsapp}
                  />
                )}
              </>
            )
          )}
        </div>
      </div>
    </section>
  );
}

export default PavingDesigner;
