"use client";

import { useEffect, useRef, useState } from "react";
import {
  createLShapePreset,
  createRectanglePreset,
  createTrapezoidPreset,
  createUShapePreset,
} from "@/lib/paving/adapters/preset";
import type { ProjectGeometry } from "@/lib/paving/geometry/types";
import { IconAlert } from "./Icons";
import css from "./PavingDesigner.module.css";
import type { SiteInputStatus } from "./site-status";

/** Jeda setelah ketukan terakhir sebelum geometri dikirim (dan layout dihitung ulang). */
export const GEOMETRY_DEBOUNCE_MS = 250;

type PresetType = "rect" | "l-shape" | "u-shape" | "trapezoid";

interface Props {
  onGeometryChange: (geom: ProjectGeometry) => void;
  /** "editing" selama jeda ketik; "invalid" bila ukuran tidak membentuk lahan yang sah. */
  onStatusChange?: (status: SiteInputStatus) => void;
}

const PRESET_OPTIONS: Array<{ id: PresetType; label: string }> = [
  { id: "rect", label: "Persegi Panjang" },
  { id: "l-shape", label: "Bentuk L" },
  { id: "u-shape", label: "Bentuk U" },
  { id: "trapezoid", label: "Trapesium" },
];

function MeterInput({
  id,
  label,
  value,
  min,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min?: number;
  onChange: (val: number) => void;
}) {
  return (
    <div className={css.field}>
      <label className={css.label} htmlFor={id}>
        {label}
      </label>
      <div className={css.inputWrap}>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step="0.1"
          min={min}
          className={`${css.input} ${css.inputWithUnit}`}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className={css.unit} aria-hidden="true">
          m
        </span>
      </div>
    </div>
  );
}

export function PresetForm({ onGeometryChange, onStatusChange }: Props) {
  const [type, setType] = useState<PresetType>("rect");
  const statusCbRef = useRef(onStatusChange);
  statusCbRef.current = onStatusChange;

  // Rectangle state
  const [rectLen, setRectLen] = useState(10);
  const [rectWid, setRectWid] = useState(5);

  // L-Shape state
  const [lTotalW, setLTotalW] = useState(10);
  const [lTotalH, setLTotalH] = useState(8);
  const [lLegW, setLLegW] = useState(4);
  const [lLegH, setLLegH] = useState(4);

  // U-Shape state
  const [uTotalW, setUTotalW] = useState(12);
  const [uTotalH, setUTotalH] = useState(8);
  const [uLeftLegW, setULeftLegW] = useState(3);
  const [uRightLegW, setURightLegW] = useState(3);
  const [uBaseH, setUBaseH] = useState(3);

  // Trapezoid state
  const [trapBottomW, setTrapBottomW] = useState(10);
  const [trapTopW, setTrapTopW] = useState(6);
  const [trapH, setTrapH] = useState(5);
  const [trapOffset, setTrapOffset] = useState(2);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Debounce: jangan memicu layout per ketukan; kirim setelah pengguna berhenti mengetik.
    // Selama jeda, hasil di layar milik ukuran sebelumnya: beri tahu induk ("menghitung...").
    statusCbRef.current?.("editing");
    const timer = window.setTimeout(() => {
      try {
        setError(null);
        let geom: ProjectGeometry;

        if (type === "rect") {
          geom = createRectanglePreset(rectLen, rectWid);
        } else if (type === "l-shape") {
          geom = createLShapePreset(lTotalW, lTotalH, lLegW, lLegH);
        } else if (type === "u-shape") {
          geom = createUShapePreset(uTotalW, uTotalH, uLeftLegW, uRightLegW, uBaseH);
        } else {
          geom = createTrapezoidPreset(trapBottomW, trapTopW, trapH, trapOffset);
        }

        onGeometryChange(geom);
      } catch (err: any) {
        setError(err?.message || "Ukuran dimensi tidak valid.");
        statusCbRef.current?.("invalid");
      }
    }, GEOMETRY_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [
    type,
    rectLen,
    rectWid,
    lTotalW,
    lTotalH,
    lLegW,
    lLegH,
    uTotalW,
    uTotalH,
    uLeftLegW,
    uRightLegW,
    uBaseH,
    trapBottomW,
    trapTopW,
    trapH,
    trapOffset,
    onGeometryChange,
  ]);

  return (
    <div className={css.stack}>
      <div className={css.field}>
        <span className={css.label}>Bentuk Dasar Lahan</span>
        <div className={css.segGroup} role="radiogroup" aria-label="Bentuk dasar lahan">
          {PRESET_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={type === opt.id}
              className={`${css.segPill} ${type === opt.id ? css.segPillActive : ""}`}
              onClick={() => setType(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {type === "rect" && (
        <div className={css.formGrid}>
          <MeterInput
            id="rect-len"
            label="Panjang"
            min={0.5}
            value={rectLen}
            onChange={(v) => setRectLen(Math.max(0.1, v))}
          />
          <MeterInput
            id="rect-wid"
            label="Lebar"
            min={0.5}
            value={rectWid}
            onChange={(v) => setRectWid(Math.max(0.1, v))}
          />
        </div>
      )}

      {type === "l-shape" && (
        <div className={css.formGrid}>
          <MeterInput id="l-total-w" label="Lebar Sisi Bawah" min={1} value={lTotalW} onChange={setLTotalW} />
          <MeterInput id="l-total-h" label="Panjang Sisi Kiri" min={1} value={lTotalH} onChange={setLTotalH} />
          <MeterInput id="l-leg-w" label="Lebar Sayap Kiri" min={0.5} value={lLegW} onChange={setLLegW} />
          <MeterInput id="l-leg-h" label="Panjang Sayap Bawah" min={0.5} value={lLegH} onChange={setLLegH} />
        </div>
      )}

      {type === "u-shape" && (
        <div className={css.formGrid}>
          <MeterInput id="u-total-w" label="Lebar Luar Total" min={2} value={uTotalW} onChange={setUTotalW} />
          <MeterInput id="u-total-h" label="Panjang Luar Total" min={2} value={uTotalH} onChange={setUTotalH} />
          <MeterInput id="u-left-w" label="Lebar Tiang Kiri" min={0.5} value={uLeftLegW} onChange={setULeftLegW} />
          <MeterInput id="u-right-w" label="Lebar Tiang Kanan" min={0.5} value={uRightLegW} onChange={setURightLegW} />
          <MeterInput id="u-base-h" label="Tebal Dasar U" min={0.5} value={uBaseH} onChange={setUBaseH} />
        </div>
      )}

      {type === "trapezoid" && (
        <div className={css.formGrid}>
          <MeterInput id="trap-bot" label="Lebar Alas Bawah" min={1} value={trapBottomW} onChange={setTrapBottomW} />
          <MeterInput id="trap-top" label="Lebar Sisi Atas" min={1} value={trapTopW} onChange={setTrapTopW} />
          <MeterInput id="trap-h" label="Panjang Tegak" min={1} value={trapH} onChange={setTrapH} />
          <MeterInput id="trap-off" label="Pergeseran Sisi Atas" value={trapOffset} onChange={setTrapOffset} />
        </div>
      )}

      {error && (
        <div className={css.warningBox} role="alert">
          <IconAlert size={17} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
