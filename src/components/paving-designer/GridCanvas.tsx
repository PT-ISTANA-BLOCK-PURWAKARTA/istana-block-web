"use client";

import { useMemo, useRef, useState } from "react";
import { multiPolygonArea, multiPolygonBounds, multiPolygonPerimeter } from "@/lib/paving/geometry/area";
import type { Point2D, ProjectGeometry, Ring2D } from "@/lib/paving/geometry/types";
import { validateGeometry } from "@/lib/paving/geometry/validate";
import { IconAlert, IconCheck, IconTrash, IconUndo } from "./Icons";
import css from "./PavingDesigner.module.css";

interface Props {
  onGeometryChange: (geom: ProjectGeometry) => void;
}

const SNAP_OPTIONS = [
  { v: 0.25, label: "0,25 m" },
  { v: 0.5, label: "0,5 m" },
  { v: 1, label: "1 m" },
];

export function GridCanvas({ onGeometryChange }: Props) {
  const [points, setPoints] = useState<Point2D[]>([]);
  const [isClosed, setIsClosed] = useState(false);
  const [gridSnap, setGridSnap] = useState(0.5);
  const [gridExtentM] = useState(20);
  const [hoverPt, setHoverPt] = useState<Point2D | null>(null);
  const [error, setError] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const snap = (v: number) => Math.round(v / gridSnap) * gridSnap;

  const getMeterCoords = (e: React.MouseEvent<SVGSVGElement>): Point2D | null => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const normX = clientX / rect.width;
    const normY = 1 - clientY / rect.height;

    const meterX = snap(normX * gridExtentM);
    const meterY = snap(normY * gridExtentM);

    return [Math.max(0, Math.min(gridExtentM, meterX)), Math.max(0, Math.min(gridExtentM, meterY))];
  };

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isClosed) return;
    const pt = getMeterCoords(e);
    if (!pt) return;

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
    setHoverPt(getMeterCoords(e));
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
    }
    setPoints((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleReset = () => {
    setPoints([]);
    setIsClosed(false);
    setError(null);
  };

  const gridLines = useMemo(() => {
    const lines = [];
    for (let m = 0; m <= gridExtentM; m += 1) {
      lines.push({ val: m, isMajor: m % 5 === 0 });
    }
    return lines;
  }, [gridExtentM]);

  return (
    <div className={css.stack}>
      <div className={css.gridHeaderBar}>
        <span className={css.label}>
          {isClosed
            ? "Bentuk lahan tertutup dan siap dihitung"
            : `Klik kanvas untuk menandai sudut (${points.length} titik)`}
        </span>
        <div className={css.snapGroup} role="group" aria-label="Ketelitian grid">
          {SNAP_OPTIONS.map((opt) => (
            <button
              key={opt.v}
              type="button"
              className={`${css.snapBtn} ${gridSnap === opt.v ? css.snapBtnActive : ""}`}
              aria-pressed={gridSnap === opt.v}
              onClick={() => setGridSnap(opt.v)}
            >
              Snap {opt.label}
            </button>
          ))}
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
          <g>
            {gridLines.map(({ val, isMajor }) => (
              <g key={`grid_${val}`}>
                <line
                  x1={val}
                  y1={0}
                  x2={val}
                  y2={gridExtentM}
                  stroke={isMajor ? "rgba(14, 42, 107, 0.2)" : "rgba(14, 42, 107, 0.07)"}
                  strokeWidth={isMajor ? 0.08 : 0.04}
                />
                <line
                  x1={0}
                  y1={val}
                  x2={gridExtentM}
                  y2={val}
                  stroke={isMajor ? "rgba(14, 42, 107, 0.2)" : "rgba(14, 42, 107, 0.07)"}
                  strokeWidth={isMajor ? 0.08 : 0.04}
                />
              </g>
            ))}
          </g>

          {isClosed && points.length >= 3 && (
            <polygon
              points={points.map(([x, y]) => `${x},${gridExtentM - y}`).join(" ")}
              fill="rgba(37, 65, 134, 0.14)"
              stroke="var(--biru, #254186)"
              strokeWidth="0.16"
            />
          )}

          {points.length > 1 && (
            <polyline
              points={points.map(([x, y]) => `${x},${gridExtentM - y}`).join(" ")}
              fill="none"
              stroke="var(--biru, #254186)"
              strokeWidth="0.14"
              strokeLinejoin="round"
            />
          )}

          {!isClosed && points.length > 0 && hoverPt && (
            <line
              x1={points[points.length - 1][0]}
              y1={gridExtentM - points[points.length - 1][1]}
              x2={hoverPt[0]}
              y2={gridExtentM - hoverPt[1]}
              stroke="rgba(37, 65, 134, 0.55)"
              strokeWidth="0.09"
              strokeDasharray="0.3 0.2"
            />
          )}

          {points.map(([x, y], idx) => {
            const isFirst = idx === 0;
            return (
              <circle
                key={`pt_${idx}`}
                cx={x}
                cy={gridExtentM - y}
                r={isFirst ? 0.36 : 0.25}
                fill={isFirst ? "var(--oranye, #fe5722)" : "var(--biru, #254186)"}
                stroke="#fff"
                strokeWidth="0.07"
              />
            );
          })}
        </svg>

        <div className={css.scaleBadge}>
          {hoverPt
            ? `X: ${hoverPt[0].toFixed(1)} m · Y: ${hoverPt[1].toFixed(1)} m`
            : `Bidang kanvas: ${gridExtentM} × ${gridExtentM} m`}
        </div>
      </div>

      <div className={css.mapActions}>
        {!isClosed && points.length >= 3 && (
          <button type="button" className="btn btn-blue btn-sm" onClick={handleManualClose}>
            <IconCheck size={15} />
            <span>Tutup Poligon</span>
          </button>
        )}
        {points.length > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleUndo}>
            <IconUndo size={15} />
            <span>Hapus Titik Terakhir</span>
          </button>
        )}
        {points.length > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleReset}>
            <IconTrash size={15} />
            <span>Ulangi</span>
          </button>
        )}
      </div>

      {error && (
        <div className={css.warningBox} role="alert">
          <IconAlert size={17} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
