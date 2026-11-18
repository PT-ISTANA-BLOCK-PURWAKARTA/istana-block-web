"use client";

import { useMemo, useState } from "react";
import type { LayoutResult } from "@/lib/paving/engine/types";
import type { ProjectGeometry } from "@/lib/paving/geometry/types";
import css from "./PavingDesigner.module.css";

interface Props {
  geometry: ProjectGeometry;
  layout: LayoutResult;
}

/** Warna blok per peran (abu natural, merah, hitam) mengikuti palet produk Istana Block. */
const ROLE_COLORS = ["#B5B4AF", "#9C4A3A", "#2C2B29"];
const JOINT_COLOR = "#ffffff";
const CUT_EDGE_COLOR = "#d63f12";
const CUT_HIGHLIGHT_FILL = "#ffe6dc";

export function Preview2D({ geometry, layout }: Props) {
  const [showCutsOnly, setShowCutsOnly] = useState(false);

  const { width, viewBox, siteW, siteH, aspect } = useMemo(() => {
    const b = geometry.metrics.bounds;
    const sw = b.maxX - b.minX;
    const sh = b.maxY - b.minY;
    const pad = Math.max(0.25, Math.max(sw, sh) * 0.05);
    const x0 = b.minX - pad;
    const y0 = b.minY - pad;
    const w = sw + pad * 2;
    const h = sh + pad * 2;
    return {
      width: w,
      siteW: sw,
      siteH: sh,
      aspect: Math.min(Math.max(w / h, 1), 2.2),
      viewBox: `${x0} ${y0} ${w} ${h}`,
    };
  }, [geometry]);

  const jointWidth = Math.max(0.006, width * 0.0011);
  const cutEdgeWidth = Math.max(0.012, width * 0.0018);
  const outlineWidth = Math.max(0.018, width * 0.0018);

  return (
    <div className={css.stack}>
      <div className={css.previewTools}>
        <span className={css.scaleChip}>
          Skala otomatis · {siteW.toFixed(1)} × {siteH.toFixed(1)} m ({geometry.metrics.areaM2.toFixed(1)} m²)
        </span>
        <button
          type="button"
          className={`${css.toggleBtn} ${showCutsOnly ? css.toggleActive : ""}`}
          aria-pressed={showCutsOnly}
          onClick={() => setShowCutsOnly((v) => !v)}
        >
          {showCutsOnly ? "Tampilkan Semua Blok" : "Sorot Potongan Tepi"}
        </button>
      </div>

      <div className={css.canvasWrap} style={{ aspectRatio: aspect }}>
        <svg
          viewBox={viewBox}
          className={css.svgStage}
          preserveAspectRatio="xMidYMid meet"
          style={{ transform: "scaleY(-1)" }}
          role="img"
          aria-label={`Denah 2D paving ukuran ${siteW.toFixed(1)} kali ${siteH.toFixed(1)} meter`}
        >
          {geometry.geometry.map((poly, pIdx) => (
            <polygon
              key={`site_bg_${pIdx}`}
              points={poly[0].map(([x, y]) => `${x},${y}`).join(" ")}
              fill="#ffffff"
            />
          ))}

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
          <span className={css.swatchStack}>
            {ROLE_COLORS.map((color) => (
              <span key={color} className={css.legendSwatch} style={{ background: color }} />
            ))}
          </span>
          Blok utuh ({layout.metrics.fullCount.toLocaleString("id-ID")})
        </span>
        <span className={css.legendItem}>
          <span
            className={css.legendSwatch}
            style={{ background: ROLE_COLORS[0], border: "1.5px solid #d63f12" }}
          />
          Potongan tepi ({layout.metrics.partialCount.toLocaleString("id-ID")})
        </span>
      </div>
    </div>
  );
}
