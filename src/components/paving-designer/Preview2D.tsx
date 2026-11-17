"use client";

import { useMemo, useState } from "react";
import type { LayoutResult } from "@/lib/paving/engine/types";
import type { ProjectGeometry } from "@/lib/paving/geometry/types";
import css from "./PavingDesigner.module.css";

interface Props {
  geometry: ProjectGeometry;
  layout: LayoutResult;
}

/** Warna blok per peran (abu natural, merah, hitam) mengikuti palet produk. */
const ROLE_COLORS = ["#B5B4AF", "#9C4A3A", "#2C2B29"];
const JOINT_COLOR = "#ffffff";
const CUT_EDGE_COLOR = "#d63f12"; // --oranye-cta
const CUT_HIGHLIGHT_FILL = "#ffe6dc"; // --oranye-muda

export function Preview2D({ geometry, layout }: Props) {
  const [showCutsOnly, setShowCutsOnly] = useState(false);

  // Compute bounding box with a small margin; the stage follows the site's own ratio
  // so a wide site is not squeezed into empty space.
  const { minX, minY, width, height, viewBox, siteW, siteH, aspect } = useMemo(() => {
    const b = geometry.metrics.bounds;
    const sw = b.maxX - b.minX;
    const sh = b.maxY - b.minY;
    const pad = Math.max(0.25, Math.max(sw, sh) * 0.05);
    const x0 = b.minX - pad;
    const y0 = b.minY - pad;
    const w = sw + pad * 2;
    const h = sh + pad * 2;
    return {
      minX: x0,
      minY: y0,
      width: w,
      height: h,
      siteW: sw,
      siteH: sh,
      aspect: Math.min(Math.max(w / h, 1), 2.4),
      viewBox: `${x0} ${y0} ${w} ${h}`,
    };
  }, [geometry]);

  // Stroke widths are in meters and scale with the field so they stay ~1 px on screen.
  const jointWidth = Math.max(0.006, width * 0.0011);
  const cutEdgeWidth = Math.max(0.012, width * 0.0018);
  const outlineWidth = Math.max(0.018, width * 0.0018);

  return (
    <div className={css.panel}>
      <div className={css.panelHeader}>
        <div>
          <h3 className={css.panelTitle}>Pratinjau Pola 2D Lapangan</h3>
          <span className={css.statLabel}>
            {geometry.metrics.areaM2.toFixed(1)} m² · {layout.metrics.fullCount} utuh ·{" "}
            {layout.metrics.partialCount} potongan
          </span>
        </div>
        <div className={css.previewTools}>
          <span className={css.scaleChip}>
            📐 Skala otomatis · {siteW.toFixed(1)} × {siteH.toFixed(1)} m
          </span>
          <button
            type="button"
            className={`${css.toggleBtn} ${showCutsOnly ? css.toggleActive : ""}`}
            aria-pressed={showCutsOnly}
            onClick={() => setShowCutsOnly((v) => !v)}
          >
            {showCutsOnly ? "Tampilkan Semua" : "Sorot Potongan Tepi"}
          </button>
        </div>
      </div>

      <div className={css.canvasWrap} style={{ aspectRatio: aspect }}>
        <svg
          viewBox={viewBox}
          className={css.svgStage}
          preserveAspectRatio="xMidYMid meet"
          style={{ transform: "scaleY(-1)" }} // Flip Y so +Y is up like mathematical coordinate system
        >
          {/* Site Boundary Fill (Subtle background) */}
          {geometry.geometry.map((poly, pIdx) => (
            <polygon
              key={`site_bg_${pIdx}`}
              points={poly[0].map(([x, y]) => `${x},${y}`).join(" ")}
              fill="#ffffff"
            />
          ))}

          {/* Paving Blocks: light joints between blocks, accent edge only on cut pieces */}
          <g>
            {layout.tiles.map((tile) => {
              const isCut = tile.status === "partial";
              if (showCutsOnly && !isCut) return null;

              const baseFill = ROLE_COLORS[tile.role] || ROLE_COLORS[0];
              const fill = isCut && showCutsOnly ? CUT_HIGHLIGHT_FILL : baseFill;
              const stroke = isCut ? CUT_EDGE_COLOR : JOINT_COLOR;
              const strokeWidth = showCutsOnly
                ? cutEdgeWidth * 1.4
                : isCut
                  ? cutEdgeWidth
                  : jointWidth;

              return (
                <polygon
                  key={tile.id}
                  points={tile.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeLinejoin="round"
                />
              );
            })}
          </g>

          {/* Site Boundary Outline */}
          {geometry.geometry.map((poly, pIdx) => {
            const exterior = poly[0];
            const holes = poly.slice(1);
            return (
              <g key={`site_border_${pIdx}`}>
                <polygon
                  points={exterior.map(([x, y]) => `${x},${y}`).join(" ")}
                  fill="none"
                  stroke="#14213d"
                  strokeWidth={outlineWidth}
                  strokeLinejoin="round"
                />
                {holes.map((hole, hIdx) => (
                  <polygon
                    key={`hole_${pIdx}_${hIdx}`}
                    points={hole.map(([x, y]) => `${x},${y}`).join(" ")}
                    fill="#ffffff"
                    stroke="#14213d"
                    strokeWidth={outlineWidth}
                    strokeLinejoin="round"
                  />
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      <div className={css.legendRow}>
        <span className={css.legendItem}>
          <span className={css.legendSwatch} style={{ background: ROLE_COLORS[0] }} />
          Blok Utuh ({layout.metrics.fullCount})
        </span>
        <span className={css.legendItem}>
          <span
            className={css.legendSwatch}
            style={{
              background: ROLE_COLORS[0],
              border: "1.5px solid #d63f12",
            }}
          />
          Potongan Batas ({layout.metrics.partialCount})
        </span>
      </div>
    </div>
  );
}
