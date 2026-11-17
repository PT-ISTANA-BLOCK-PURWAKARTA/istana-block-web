"use client";

import { useMemo, useState } from "react";
import type { LayoutResult } from "@/lib/paving/engine/types";
import type { ProjectGeometry } from "@/lib/paving/geometry/types";
import { COLORS } from "@/lib/paving/legacy/types";
import css from "./PavingDesigner.module.css";

interface Props {
  geometry: ProjectGeometry;
  layout: LayoutResult;
}

export function Preview2D({ geometry, layout }: Props) {
  const [showCutsOnly, setShowCutsOnly] = useState(false);

  // Compute bounding box with padding
  const { minX, minY, maxX, maxY, width, height, viewBox } = useMemo(() => {
    const b = geometry.metrics.bounds;
    const pad = Math.max(0.5, Math.max(b.maxX - b.minX, b.maxY - b.minY) * 0.08);
    const x0 = b.minX - pad;
    const y0 = b.minY - pad;
    const w = b.maxX - b.minX + pad * 2;
    const h = b.maxY - b.minY + pad * 2;
    return {
      minX: x0,
      minY: y0,
      maxX: b.maxX + pad,
      maxY: b.maxY + pad,
      width: w,
      height: h,
      viewBox: `${x0} ${y0} ${w} ${h}`,
    };
  }, [geometry]);

  // Color lookup for roles
  const roleColors = ["#B5B4AF", "#9C4A3A", "#2C2B29"];

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
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            type="button"
            className={`${css.badge} ${showCutsOnly ? css.badgeWarning : ""}`}
            style={{ cursor: "pointer", border: 0 }}
            onClick={() => setShowCutsOnly((v) => !v)}
          >
            {showCutsOnly ? "Tampilkan Semua" : "Sorot Potongan Tepi"}
          </button>
        </div>
      </div>

      <div className={css.canvasWrap}>
        <svg
          viewBox={viewBox}
          className={css.svgStage}
          preserveAspectRatio="xMidYMid meet"
          style={{ transform: "scaleY(-1)" }} // Flip Y so +Y is up like mathematical coordinate system
        >
          {/* Site Boundary Fill (Subtle background) */}
          {geometry.geometry.map((poly, pIdx) => {
            const exterior = poly[0];
            return (
              <polygon
                key={`site_bg_${pIdx}`}
                points={exterior.map(([x, y]) => `${x},${y}`).join(" ")}
                fill="#f1f3f6"
              />
            );
          })}

          {/* Paving Blocks */}
          <g>
            {layout.tiles.map((tile) => {
              const isCut = tile.status === "partial";
              if (showCutsOnly && !isCut) return null;

              const baseFill = roleColors[tile.role] || "#B5B4AF";
              const fill = isCut ? (showCutsOnly ? "#ff8800" : baseFill) : baseFill;
              const stroke = isCut ? "#d9534f" : "rgba(0,0,0,0.18)";
              const strokeWidth = isCut ? Math.max(0.02, width * 0.003) : Math.max(0.01, width * 0.001);

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

          {/* Site Boundary Outline (Strong outer border) */}
          {geometry.geometry.map((poly, pIdx) => {
            const exterior = poly[0];
            const holes = poly.slice(1);
            return (
              <g key={`site_border_${pIdx}`}>
                <polygon
                  points={exterior.map(([x, y]) => `${x},${y}`).join(" ")}
                  fill="none"
                  stroke="#1e2229"
                  strokeWidth={Math.max(0.04, width * 0.005)}
                  strokeLinejoin="round"
                />
                {holes.map((hole, hIdx) => (
                  <polygon
                    key={`hole_${pIdx}_${hIdx}`}
                    points={hole.map(([x, y]) => `${x},${y}`).join(" ")}
                    fill="#fff"
                    stroke="#e65100"
                    strokeWidth={Math.max(0.04, width * 0.005)}
                    strokeLinejoin="round"
                  />
                ))}
              </g>
            );
          })}
        </svg>

        <div className={css.scaleBadge} style={{ transform: "none" }}>
          📐 Skala otomatis: {width.toFixed(1)} m × {height.toFixed(1)} m
        </div>
      </div>

      <div style={{ display: "flex", gap: "12px", alignItems: "center", fontSize: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "12px", height: "12px", background: "#B5B4AF", borderRadius: "3px" }} />
          <span>Blok Utuh ({layout.metrics.fullCount})</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              width: "12px",
              height: "12px",
              background: "#ff8800",
              border: "1px solid #d9534f",
              borderRadius: "3px",
            }}
          />
          <span>Potongan Batas ({layout.metrics.partialCount})</span>
        </div>
      </div>
    </div>
  );
}
