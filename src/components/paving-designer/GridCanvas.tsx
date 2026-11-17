"use client";

import { useMemo, useRef, useState } from "react";
import { multiPolygonArea, multiPolygonBounds, multiPolygonPerimeter } from "@/lib/paving/geometry/area";
import type { Point2D, ProjectGeometry, Ring2D } from "@/lib/paving/geometry/types";
import { validateGeometry } from "@/lib/paving/geometry/validate";
import css from "./PavingDesigner.module.css";

interface Props {
  onGeometryChange: (geom: ProjectGeometry) => void;
}

export function GridCanvas({ onGeometryChange }: Props) {
  const [points, setPoints] = useState<Point2D[]>([]);
  const [isClosed, setIsClosed] = useState(false);
  const [gridSnap, setGridSnap] = useState(0.5); // 0.5m snap
  const [gridExtentM, setGridExtentM] = useState(20); // 20x20 meter field
  const [hoverPt, setHoverPt] = useState<Point2D | null>(null);
  const [error, setError] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const snap = (v: number) => Math.round(v / gridSnap) * gridSnap;

  // Convert client SVG click to meter coordinates
  const getMeterCoords = (e: React.MouseEvent<SVGSVGElement>): Point2D | null => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const normX = clientX / rect.width;
    const normY = 1 - clientY / rect.height; // Y up

    const meterX = snap(normX * gridExtentM);
    const meterY = snap(normY * gridExtentM);

    return [Math.max(0, Math.min(gridExtentM, meterX)), Math.max(0, Math.min(gridExtentM, meterY))];
  };

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isClosed) return;
    const pt = getMeterCoords(e);
    if (!pt) return;

    // Check if clicking near first point to close
    if (points.length >= 3) {
      const first = points[0];
      const dist = Math.hypot(pt[0] - first[0], pt[1] - first[1]);
      if (dist <= 0.8) {
        closePolygon([...points, [first[0], first[1]]]);
        return;
      }
    }

    setPoints((prev) => [...prev, pt]);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isClosed) return;
    const pt = getMeterCoords(e);
    setHoverPt(pt);
  };

  const closePolygon = (closedRing: Ring2D) => {
    setError(null);
    const mp = [[closedRing]];
    const val = validateGeometry(mp);
    if (!val.valid) {
      setError(val.errors.join("; "));
      return;
    }

    setIsClosed(true);
    const bounds = multiPolygonBounds(mp);
    const areaM2 = Math.round(multiPolygonArea(mp) * 1e6) / 1e6;
    const perimeterM = Math.round(multiPolygonPerimeter(mp) * 1e6) / 1e6;

    const geom: ProjectGeometry = {
      schemaVersion: "1.0.0",
      source: "grid",
      sourceCrs: "local-meter",
      workingUnit: "meter",
      geometry: mp,
      metrics: {
        areaM2,
        perimeterM,
        bounds,
      },
      warnings: val.warnings,
    };

    onGeometryChange(geom);
  };

  const handleManualClose = () => {
    if (points.length < 3) {
      setError("Masukkan minimal 3 titik sudut sebelum menutup bentuk.");
      return;
    }
    closePolygon([...points, [points[0][0], points[0][1]]]);
  };

  const handleUndo = () => {
    if (isClosed) {
      setIsClosed(false);
      setPoints((prev) => prev.slice(0, -1));
    } else {
      setPoints((prev) => prev.slice(0, -1));
    }
    setError(null);
  };

  const handleReset = () => {
    setPoints([]);
    setIsClosed(false);
    setError(null);
  };

  // SVG grid lines (every 1m major, every 0.5m minor)
  const gridLines = useMemo(() => {
    const lines = [];
    for (let m = 0; m <= gridExtentM; m += 1) {
      const isMajor = m % 5 === 0;
      lines.push({ val: m, isMajor });
    }
    return lines;
  }, [gridExtentM]);

  return (
    <div className={css.field}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className={css.label}>
          {isClosed
            ? "✅ Lahan tertutup siap dihitung"
            : `Klik kanvas untuk menambah sudut (${points.length} titik dibuat)`}
        </span>
        <div style={{ display: "flex", gap: "6px" }}>
          <select
            className={css.select}
            style={{ height: "32px", fontSize: "12px", padding: "0 6px" }}
            value={gridSnap}
            onChange={(e) => setGridSnap(Number(e.target.value))}
          >
            <option value="0.25">Snap 0,25 m</option>
            <option value="0.5">Snap 0,5 m</option>
            <option value="1">Snap 1,0 m</option>
          </select>
        </div>
      </div>

      <div className={css.canvasWrap} style={{ cursor: isClosed ? "default" : "crosshair", aspectRatio: 1 }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${gridExtentM} ${gridExtentM}`}
          className={css.svgStage}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverPt(null)}
        >
          {/* Background Grid */}
          <g stroke="rgba(20, 33, 61, 0.06)" strokeWidth="0.05">
            {gridLines.map(({ val, isMajor }) => (
              <g key={`grid_${val}`}>
                <line
                  x1={val}
                  y1={0}
                  x2={val}
                  y2={gridExtentM}
                  stroke={isMajor ? "rgba(20, 33, 61, 0.18)" : "rgba(20, 33, 61, 0.07)"}
                  strokeWidth={isMajor ? 0.08 : 0.04}
                />
                <line
                  x1={0}
                  y1={val}
                  x2={gridExtentM}
                  y2={val}
                  stroke={isMajor ? "rgba(20, 33, 61, 0.18)" : "rgba(20, 33, 61, 0.07)"}
                  strokeWidth={isMajor ? 0.08 : 0.04}
                />
              </g>
            ))}
          </g>

          {/* Polygon fill when closed */}
          {isClosed && points.length >= 3 && (
            <polygon
              points={points.map(([x, y]) => `${x},${gridExtentM - y}`).join(" ")}
              fill="rgba(37, 65, 134, 0.12)"
              stroke="var(--biru, #254186)"
              strokeWidth="0.15"
            />
          )}

          {/* Lines between existing points */}
          {points.length > 1 && (
            <polyline
              points={points.map(([x, y]) => `${x},${gridExtentM - y}`).join(" ")}
              fill="none"
              stroke="var(--biru, #254186)"
              strokeWidth="0.12"
              strokeLinejoin="round"
            />
          )}

          {/* Active rubber band line to cursor */}
          {!isClosed && points.length > 0 && hoverPt && (
            <line
              x1={points[points.length - 1][0]}
              y1={gridExtentM - points[points.length - 1][1]}
              x2={hoverPt[0]}
              y2={gridExtentM - hoverPt[1]}
              stroke="rgba(37, 65, 134, 0.55)"
              strokeWidth="0.08"
              strokeDasharray="0.3 0.2"
            />
          )}

          {/* Drawn vertices */}
          {points.map(([x, y], idx) => {
            const isFirst = idx === 0;
            return (
              <circle
                key={`pt_${idx}`}
                cx={x}
                cy={gridExtentM - y}
                r={isFirst ? 0.35 : 0.25}
                fill={isFirst ? "var(--oranye, #fe5722)" : "var(--biru, #254186)"}
                stroke="#fff"
                strokeWidth="0.06"
              />
            );
          })}
        </svg>

        <div className={css.scaleBadge}>
          {hoverPt ? `X: ${hoverPt[0].toFixed(1)} m · Y: ${hoverPt[1].toFixed(1)} m` : `Ukuran kanvas: ${gridExtentM} × ${gridExtentM} m`}
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {!isClosed && points.length >= 3 && (
          <button type="button" className={`${css.button} ${css.buttonPrimary}`} onClick={handleManualClose}>
            🔒 Tutup Poligon Lahan
          </button>
        )}
        {points.length > 0 && (
          <button type="button" className={`${css.button} ${css.buttonSecondary}`} onClick={handleUndo}>
            ↩️ Hapus Titik Terakhir
          </button>
        )}
        {points.length > 0 && (
          <button type="button" className={`${css.button} ${css.buttonSecondary}`} onClick={handleReset}>
            🗑️ Ulangi dari Awal
          </button>
        )}
      </div>

      {error && (
        <div className={css.badgeWarning} style={{ padding: "8px 12px", borderRadius: "10px" }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
