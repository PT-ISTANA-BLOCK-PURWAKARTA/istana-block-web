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
import { DesignerErrorBoundary, retryImport } from "./DesignerErrorBoundary";
import { EstimatePanel } from "./EstimatePanel";
import { FileImportModal } from "./FileImportModal";
import { GridCanvas } from "./GridCanvas";
import { IconAlert, IconCube, IconLayers } from "./Icons";
import { InputMethodPicker, type InputMethod } from "./InputMethodPicker";
import css from "./PavingDesigner.module.css";
import { PresetForm } from "./PresetForm";
import { Preview2D } from "./Preview2D";

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

const DynamicPavingDesigner3D = dynamic(
  () => retryImport(() => import("./PavingDesigner3D").then((mod) => mod.PavingDesigner3D)),
  {
    ssr: false,
    loading: () => (
      <div className={css.loadingBox}>
        <p>Memuat visualisasi 3D interaktif...</p>
      </div>
    ),
  },
);

interface Props {
  whatsapp: string;
}

const RESERVE_OPTIONS = [
  { v: 0, label: "0%" },
  { v: 3, label: "3%" },
  { v: 5, label: "5% (Lurus)" },
  { v: 10, label: "10% (Miring/Hex)" },
];

const ROTATION_OPTIONS = [
  { v: 0, label: "Lurus (0°)" },
  { v: 45, label: "Miring Diagonal (45°)" },
];

export function PavingDesigner({ whatsapp }: Props) {
  const [activeMethod, setActiveMethod] = useState<InputMethod>("preset");
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");

  const [geometry, setGeometry] = useState<ProjectGeometry>(() => createRectanglePreset(10, 5));

  const [productId, setProductId] = useState<ProductId>("truepave");
  const [motifId, setMotifId] = useState<string>("bata");
  const [reservePercent, setReservePercent] = useState<number>(5);
  const [rotationDeg, setRotationDeg] = useState<number>(0);

  const productSpec = PAVING_CATALOG[productId];
  const productData = PRODUCTS[productId];
  const motifs = useMemo(() => productData?.motifs || [], [productData]);

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
        <div className={css.introTop}>
          <span className="pill pill-orange">Kalkulator Lahan Dinamis</span>
          <span className={css.areaPill}>Luas Aktif: {geometry.metrics.areaM2.toFixed(1)} m²</span>
        </div>
        <h2 className={css.introTitle}>Desain &amp; Potongan Paving Sesuai Bentuk Lahan</h2>
        <p className={css.introText}>
          Tentukan batas lahan Anda dengan preset bentuk L/U/trapesium, kanvas grid bermeter, peta
          satelit, atau impor GeoJSON/KML. Sistem menghitung blok utuh, potongan tepi, dan
          rekomendasi pembelian secara akurat.
        </p>
        <InputMethodPicker activeMethod={activeMethod} onChange={setActiveMethod} />
      </div>

      <div className={css.workspace}>
        {/* Kolom Kiri: Langkah 1 & Langkah 2 */}
        <div className={css.leftCol}>
          <div className={css.panel}>
            <div className={css.stepHead}>
              <div className={css.stepHeadLeft}>
                <span className={`${css.stepHex} hex`} aria-hidden="true">
                  1
                </span>
                <div>
                  <h3 className={css.panelTitle}>Bentuk &amp; Dimensi Lahan</h3>
                  <p className={css.panelSub}>Pilih ukuran atau gambar langsung batas area proyek</p>
                </div>
              </div>
              <span className={css.areaPill}>{geometry.metrics.areaM2.toFixed(1)} m²</span>
            </div>

            {activeMethod === "preset" && <PresetForm onGeometryChange={setGeometry} />}

            {activeMethod === "grid" && <GridCanvas onGeometryChange={setGeometry} />}

            {activeMethod === "map" && (
              <DesignerErrorBoundary
                title="Peta satelit tidak dapat dimuat"
                fallbackHint="Terjadi kendala saat mengunduh modul peta satelit. Anda dapat mencoba lagi atau beralih ke mode Bentuk Siap Pakai."
                resetKey={activeMethod}
                onFallbackAction={() => setActiveMethod("preset")}
                fallbackActionLabel="Gunakan Bentuk Siap Pakai"
              >
                <DynamicMapDrawer onApplyGeometry={setGeometry} />
              </DesignerErrorBoundary>
            )}

            {activeMethod === "import" && <FileImportModal onApplyGeometry={setGeometry} />}
          </div>

          <div className={css.panel}>
            <div className={css.stepHead}>
              <div className={css.stepHeadLeft}>
                <span className={`${css.stepHex} hex`} aria-hidden="true">
                  2
                </span>
                <div>
                  <h3 className={css.panelTitle}>Jenis Paving &amp; Pola Pasang</h3>
                  <p className={css.panelSub}>Sesuaikan produk, motif, kemiringan, dan cadangan potong</p>
                </div>
              </div>
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
            </div>

            <div className={css.field}>
              <span className={css.label}>Kemiringan Pola</span>
              <div className={css.segGroup} role="radiogroup" aria-label="Kemiringan pola paving">
                {ROTATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    role="radio"
                    aria-checked={rotationDeg === opt.v}
                    className={`${css.segPill} ${rotationDeg === opt.v ? css.segPillActive : ""}`}
                    onClick={() => setRotationDeg(opt.v)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={css.field}>
              <span className={css.label}>Cadangan Potong &amp; Pecah</span>
              <div className={css.segGroup} role="radiogroup" aria-label="Persentase cadangan potong">
                {RESERVE_OPTIONS.map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    role="radio"
                    aria-checked={reservePercent === opt.v}
                    className={`${css.segPill} ${reservePercent === opt.v ? css.segPillActive : ""}`}
                    onClick={() => setReservePercent(opt.v)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Pratinjau 2D/3D Terpadu & Estimasi Material */}
        <div className={css.rightCol}>
          {error ? (
            <div className={css.panel}>
              <div className={css.errorAlert} role="alert">
                <IconAlert size={18} />
                <div>
                  <strong>Terjadi kendala perhitungan:</strong> {error}
                </div>
              </div>
            </div>
          ) : (
            layout && (
              <>
                <div className={css.panel}>
                  <div className={css.panelHeader}>
                    <div>
                      <h3 className={css.panelTitle}>
                        {viewMode === "2d" ? "Pratinjau Denah 2D" : "Visualisasi 3D Lahan"}
                      </h3>
                      <p className={css.panelSub}>
                        {layout.metrics.fullCount.toLocaleString("id-ID")} utuh ·{" "}
                        {layout.metrics.partialCount.toLocaleString("id-ID")} potongan tepi
                      </p>
                    </div>
                  </div>

                  <div className={css.viewToggle} role="group" aria-label="Mode tampilan pratinjau">
                    <button
                      type="button"
                      className={`${css.viewBtn} ${viewMode === "2d" ? css.viewBtnActive : ""}`}
                      aria-pressed={viewMode === "2d"}
                      onClick={() => setViewMode("2d")}
                    >
                      <IconLayers size={16} />
                      <span>2D Denah Atas</span>
                    </button>
                    <button
                      type="button"
                      className={`${css.viewBtn} ${viewMode === "3d" ? css.viewBtnActive : ""}`}
                      aria-pressed={viewMode === "3d"}
                      onClick={() => setViewMode("3d")}
                    >
                      <IconCube size={16} />
                      <span>3D Interaktif</span>
                    </button>
                  </div>

                  {viewMode === "2d" ? (
                    <Preview2D geometry={geometry} layout={layout} />
                  ) : (
                    <DesignerErrorBoundary
                      title="Visualisasi 3D gagal dimuat"
                      fallbackHint="Modul grafis 3D gagal diunduh atau dibatasi perangkat. Anda tetap bisa melihat pola dan perhitungan penuh di tampilan 2D."
                      resetKey={`${viewMode}-${geometry.metrics.areaM2}-${productId}-${motifId}`}
                      onFallbackAction={() => setViewMode("2d")}
                      fallbackActionLabel="Kembali ke Denah 2D"
                    >
                      <DynamicPavingDesigner3D
                        layout={layout}
                        geometry={geometry}
                        tebalCm={productSpec.tebalCm[0]}
                        showKanstin={true}
                        onSwitchTo2D={() => setViewMode("2d")}
                      />
                    </DesignerErrorBoundary>
                  )}
                </div>

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
