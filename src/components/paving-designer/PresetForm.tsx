"use client";

import { useEffect, useState } from "react";
import {
  createLShapePreset,
  createRectanglePreset,
  createTrapezoidPreset,
  createUShapePreset,
} from "@/lib/paving/adapters/preset";
import type { ProjectGeometry } from "@/lib/paving/geometry/types";
import css from "./PavingDesigner.module.css";

type PresetType = "rect" | "l-shape" | "u-shape" | "trapezoid";

interface Props {
  onGeometryChange: (geom: ProjectGeometry) => void;
}

export function PresetForm({ onGeometryChange }: Props) {
  const [type, setType] = useState<PresetType>("rect");

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
    }
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
    <div className={css.field}>
      <div className={css.field}>
        <label className={css.label} htmlFor="preset-type-select">
          Pilih Bentuk Lahan
        </label>
        <select
          id="preset-type-select"
          className={css.select}
          value={type}
          onChange={(e) => setType(e.target.value as PresetType)}
        >
          <option value="rect">Persegi Panjang / Bujur Sangkar</option>
          <option value="l-shape">Bentuk L (Halaman Menyudut)</option>
          <option value="u-shape">Bentuk U (Halaman Mengelilingi Bangunan)</option>
          <option value="trapezoid">Trapesium (Lahan Menyempit)</option>
        </select>
      </div>

      {type === "rect" && (
        <div className={css.formGrid}>
          <div className={css.field}>
            <label className={css.label} htmlFor="rect-len">
              Panjang (meter)
            </label>
            <input
              id="rect-len"
              type="number"
              step="0.1"
              min="1"
              className={css.input}
              value={rectLen}
              onChange={(e) => setRectLen(Math.max(0.1, Number(e.target.value)))}
            />
          </div>
          <div className={css.field}>
            <label className={css.label} htmlFor="rect-wid">
              Lebar (meter)
            </label>
            <input
              id="rect-wid"
              type="number"
              step="0.1"
              min="1"
              className={css.input}
              value={rectWid}
              onChange={(e) => setRectWid(Math.max(0.1, Number(e.target.value)))}
            />
          </div>
        </div>
      )}

      {type === "l-shape" && (
        <div className={css.formGrid}>
          <div className={css.field}>
            <label className={css.label} htmlFor="l-total-w">
              Lebar Total Sisi Bawah (m)
            </label>
            <input
              id="l-total-w"
              type="number"
              step="0.1"
              min="1"
              className={css.input}
              value={lTotalW}
              onChange={(e) => setLTotalW(Number(e.target.value))}
            />
          </div>
          <div className={css.field}>
            <label className={css.label} htmlFor="l-total-h">
              Panjang Total Sisi Kiri (m)
            </label>
            <input
              id="l-total-h"
              type="number"
              step="0.1"
              min="1"
              className={css.input}
              value={lTotalH}
              onChange={(e) => setLTotalH(Number(e.target.value))}
            />
          </div>
          <div className={css.field}>
            <label className={css.label} htmlFor="l-leg-w">
              Lebar Sayap Kiri (m)
            </label>
            <input
              id="l-leg-w"
              type="number"
              step="0.1"
              min="0.5"
              className={css.input}
              value={lLegW}
              onChange={(e) => setLLegW(Number(e.target.value))}
            />
          </div>
          <div className={css.field}>
            <label className={css.label} htmlFor="l-leg-h">
              Panjang Sayap Bawah (m)
            </label>
            <input
              id="l-leg-h"
              type="number"
              step="0.1"
              min="0.5"
              className={css.input}
              value={lLegH}
              onChange={(e) => setLLegH(Number(e.target.value))}
            />
          </div>
        </div>
      )}

      {type === "u-shape" && (
        <div className={css.formGrid}>
          <div className={css.field}>
            <label className={css.label} htmlFor="u-total-w">
              Lebar Total Luar (m)
            </label>
            <input
              id="u-total-w"
              type="number"
              step="0.1"
              min="2"
              className={css.input}
              value={uTotalW}
              onChange={(e) => setUTotalW(Number(e.target.value))}
            />
          </div>
          <div className={css.field}>
            <label className={css.label} htmlFor="u-total-h">
              Panjang Total Luar (m)
            </label>
            <input
              id="u-total-h"
              type="number"
              step="0.1"
              min="2"
              className={css.input}
              value={uTotalH}
              onChange={(e) => setUTotalH(Number(e.target.value))}
            />
          </div>
          <div className={css.field}>
            <label className={css.label} htmlFor="u-left-w">
              Lebar Tiang Kiri (m)
            </label>
            <input
              id="u-left-w"
              type="number"
              step="0.1"
              min="0.5"
              className={css.input}
              value={uLeftLegW}
              onChange={(e) => setULeftLegW(Number(e.target.value))}
            />
          </div>
          <div className={css.field}>
            <label className={css.label} htmlFor="u-right-w">
              Lebar Tiang Kanan (m)
            </label>
            <input
              id="u-right-w"
              type="number"
              step="0.1"
              min="0.5"
              className={css.input}
              value={uRightLegW}
              onChange={(e) => setURightLegW(Number(e.target.value))}
            />
          </div>
          <div className={css.field}>
            <label className={css.label} htmlFor="u-base-h">
              Tebal Lantai Bawah U (m)
            </label>
            <input
              id="u-base-h"
              type="number"
              step="0.1"
              min="0.5"
              className={css.input}
              value={uBaseH}
              onChange={(e) => setUBaseH(Number(e.target.value))}
            />
          </div>
        </div>
      )}

      {type === "trapezoid" && (
        <div className={css.formGrid}>
          <div className={css.field}>
            <label className={css.label} htmlFor="trap-bot">
              Lebar Alas Bawah (m)
            </label>
            <input
              id="trap-bot"
              type="number"
              step="0.1"
              min="1"
              className={css.input}
              value={trapBottomW}
              onChange={(e) => setTrapBottomW(Number(e.target.value))}
            />
          </div>
          <div className={css.field}>
            <label className={css.label} htmlFor="trap-top">
              Lebar Sisi Atas (m)
            </label>
            <input
              id="trap-top"
              type="number"
              step="0.1"
              min="1"
              className={css.input}
              value={trapTopW}
              onChange={(e) => setTrapTopW(Number(e.target.value))}
            />
          </div>
          <div className={css.field}>
            <label className={css.label} htmlFor="trap-h">
              Panjang / Tinggi Tegak (m)
            </label>
            <input
              id="trap-h"
              type="number"
              step="0.1"
              min="1"
              className={css.input}
              value={trapH}
              onChange={(e) => setTrapH(Number(e.target.value))}
            />
          </div>
          <div className={css.field}>
            <label className={css.label} htmlFor="trap-off">
              Pergeseran Sisi Atas (m)
            </label>
            <input
              id="trap-off"
              type="number"
              step="0.1"
              className={css.input}
              value={trapOffset}
              onChange={(e) => setTrapOffset(Number(e.target.value))}
            />
          </div>
        </div>
      )}

      {error && (
        <div className={css.badgeWarning} style={{ padding: "8px 12px", borderRadius: "10px" }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
