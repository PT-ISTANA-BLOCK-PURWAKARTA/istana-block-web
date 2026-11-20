"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ProjectGeometry } from "@/lib/paving/geometry/types";
import { fitView, groupPacked, jointWidthM, strokeWidthsM, viewAspect } from "@/lib/paving/render/draw-plan";
import type { PackedLayoutResult } from "@/lib/paving/render/packed-tiles";
import { drawGrassHoles, grassCfgFor } from "@/lib/paving/render/draw-grass";
import type { ProductId } from "@/lib/paving/legacy/types";
import css from "./PavingDesigner.module.css";

interface Props {
  geometry: ProjectGeometry;
  layout: PackedLayoutResult;
  roleColors?: string[];
  /** Grass Block menggambar lubang rumput (utuh & potongan); produk lain tidak. */
  productId?: ProductId;
  motifId?: string;
  rotationDeg?: number;
}

/** Warna blok per peran (abu natural, merah, hitam) mengikuti palet produk Istana Block. */
const DEFAULT_ROLE_COLORS = ["#B5B4AF", "#9C4A3A", "#2C2B29"];
const JOINT_COLOR = "#ffffff";
const CUT_EDGE_COLOR = "#d63f12";
const CUT_HIGHLIGHT_FILL = "#ffe6dc";
const OUTLINE_COLOR = "#14213d";
/** Batas piksel fisik kanvas per sisi (menjaga memori pada layar sangat padat/lebar). */
const MAX_BACKING_PX = 2400;
/** Anggaran waktu (ms) per irisan gambar sebelum menyerahkan kendali ke browser (provisional). */
const DRAW_SLICE_MS = 12;
/** Keping per pemeriksaan waktu (menjaga biaya performance.now() tetap kecil). */
const TILES_PER_CLOCK_CHECK = 1024;

/** Keping per irisan untuk lubang rumput Grass Block. */
const GRASS_TILES_PER_SLICE = 4096;

const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Pratinjau denah 2D. Digambar ke <canvas> langsung dari typed array hasil worker:
 * satu fill + satu stroke per irisan keping (bukan satu elemen DOM per keping) dan dipecah
 * dalam irisan waktu ~12 ms, sehingga lahan ribuan m² (ratusan ribu keping) tergambar tanpa
 * membekukan tab. Lahan kecil selesai dalam satu irisan (sinkron, tanpa kedip).
 */
export function Preview2D({ geometry, layout, roleColors, productId, motifId, rotationDeg = 0 }: Props) {
  const [showCutsOnly, setShowCutsOnly] = useState(false);
  const palette = roleColors && roleColors.length > 0 ? roleColors : DEFAULT_ROLE_COLORS;
  const uniquePalette = Array.from(new Set(palette));
  const paletteKey = palette.join(",");

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const { siteW, siteH, aspect } = useMemo(() => {
    const b = geometry.metrics.bounds;
    return { siteW: b.maxX - b.minX, siteH: b.maxY - b.minY, aspect: viewAspect(b) };
  }, [geometry]);

  // Pengelompokan keping per gaya: dihitung ulang hanya saat layout/sorotan berubah.
  const groups = useMemo(() => groupPacked(layout.packed, showCutsOnly), [layout, showCutsOnly]);

  const grassCfg = useMemo(
    () => grassCfgFor(productId, motifId, rotationDeg),
    [productId, motifId, rotationDeg],
  );

  // Ukuran kanvas mengikuti pembungkus (responsif, termasuk saat dilipat/dibesarkan).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      setBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || box.w < 2 || box.h < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2, MAX_BACKING_PX / box.w, MAX_BACKING_PX / box.h);
    const pw = Math.max(1, Math.round(box.w * dpr));
    const ph = Math.max(1, Math.round(box.h * dpr));
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const colors = paletteKey.split(",");
    const fit = fitView(geometry.metrics.bounds, box.w, box.h);
    const sw = strokeWidthsM(fit.viewWidthM);
    const avgTileArea = layout.metrics.coveredAreaM2 / Math.max(1, layout.packed.count);
    const jointM = jointWidthM(sw.joint, avgTileArea);
    const kx = pw / box.w;
    const ky = ph / box.h;
    const { coords, offsets } = layout.packed;
    let cancelled = false;

    // Meter -> piksel fisik; sumbu Y dibalik (y naik ke atas layar); lebar garis dalam meter.
    const resetTransform = () =>
      ctx.setTransform(fit.scale * kx, 0, 0, -fit.scale * ky, fit.originX * kx, fit.originY * ky);
    resetTransform();
    ctx.clearRect(-1e6, -1e6, 2e6, 2e6);
    ctx.lineJoin = "round";

    // PENTING: jangan memakai ctx.closePath() di sini. Pada Chromium, closePath() pada path dengan
    // puluhan ribu subpath berbiaya kuadratik (26.000 keping = ~12 dtk). Penutupan dilakukan manual:
    // kembali ke titik awal lalu satu ruas lagi agar sambungan di titik awal tergambar utuh.
    const traceTile = (t: number) => {
      const start = offsets[t];
      const end = offsets[t + 1];
      if (end <= start) return;
      ctx.moveTo(coords[2 * start], coords[2 * start + 1]);
      for (let j = start + 1; j < end; j++) ctx.lineTo(coords[2 * j], coords[2 * j + 1]);
      if (end - start > 2) {
        ctx.lineTo(coords[2 * start], coords[2 * start + 1]);
        ctx.lineTo(coords[2 * start + 2], coords[2 * start + 3]);
      }
    };
    const traceRing = (ring: ReadonlyArray<readonly [number, number]>) => {
      const n = ring.length;
      if (n === 0) return;
      ctx.moveTo(ring[0][0], ring[0][1]);
      for (let i = 1; i < n; i++) ctx.lineTo(ring[i][0], ring[i][1]);
      if (n > 2) {
        ctx.lineTo(ring[0][0], ring[0][1]);
        ctx.lineTo(ring[1][0], ring[1][1]);
      }
    };

    const draw = async () => {
      // Dasar putih lahan.
      ctx.beginPath();
      for (const poly of geometry.geometry) traceRing(poly[0]);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      // Keping: satu fill + satu stroke per irisan (gaya sama per kelompok).
      for (const g of groups) {
        const base = colors[g.role] || colors[0];
        if (g.partial && showCutsOnly) {
          ctx.fillStyle = CUT_HIGHLIGHT_FILL;
          ctx.lineWidth = sw.cutEdge * 1.4;
          ctx.strokeStyle = CUT_EDGE_COLOR;
        } else if (g.partial) {
          ctx.fillStyle = base;
          ctx.lineWidth = sw.cutEdge;
          ctx.strokeStyle = CUT_EDGE_COLOR;
        } else {
          ctx.fillStyle = base;
          ctx.lineWidth = jointM;
          ctx.strokeStyle = JOINT_COLOR;
        }

        const idx = g.indices;
        let i = 0;
        while (i < idx.length) {
          const sliceStart = performance.now();
          ctx.beginPath();
          do {
            const stop = Math.min(idx.length, i + TILES_PER_CLOCK_CHECK);
            for (; i < stop; i++) traceTile(idx[i]);
          } while (i < idx.length && performance.now() - sliceStart < DRAW_SLICE_MS);
          ctx.fill();
          ctx.stroke();
          if (i < idx.length) {
            await yieldToBrowser();
            if (cancelled) return;
          }
        }
      }

      // Grass Block: lubang rumput hijau (satu path + satu fill per irisan) di atas keping.
      if (grassCfg && !showCutsOnly) {
        const gOpts = { cfg: grassCfg, gapM: jointM, scale: fit.scale };
        for (let from = 0; from < layout.packed.count; from += GRASS_TILES_PER_SLICE) {
          drawGrassHoles(ctx, layout.packed, from, Math.min(layout.packed.count, from + GRASS_TILES_PER_SLICE), gOpts);
          if (from + GRASS_TILES_PER_SLICE < layout.packed.count) {
            await yieldToBrowser();
            if (cancelled) return;
          }
        }
      }

      // Garis batas lahan dan lubang.
      ctx.lineWidth = sw.outline;
      ctx.strokeStyle = OUTLINE_COLOR;
      for (const poly of geometry.geometry) {
        ctx.beginPath();
        traceRing(poly[0]);
        ctx.stroke();
        for (let h = 1; h < poly.length; h++) {
          ctx.beginPath();
          traceRing(poly[h]);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.stroke();
        }
      }
    };

    void draw();
    return () => {
      cancelled = true;
    };
  }, [box, groups, geometry, layout, paletteKey, showCutsOnly, grassCfg]);

  const summary = `Denah 2D paving ukuran ${siteW.toFixed(1)} kali ${siteH.toFixed(1)} meter, luas ${geometry.metrics.areaM2.toFixed(1)} meter persegi: ${layout.metrics.fullCount.toLocaleString("id-ID")} blok utuh dan ${layout.metrics.partialCount.toLocaleString("id-ID")} potongan tepi.`;

  return (
    <div className={css.stack}>
      <div className={css.previewTools} data-pp-compact-hide>
        <span className={css.scaleChip}>
          Skala otomatis · {siteW.toFixed(1)} × {siteH.toFixed(1)} m ({geometry.metrics.areaM2.toFixed(1)} m²)
        </span>
        <button
          type="button"
          data-pp-noprint
          className={`${css.toggleBtn} ${showCutsOnly ? css.toggleActive : ""}`}
          aria-pressed={showCutsOnly}
          onClick={() => setShowCutsOnly((v) => !v)}
        >
          {showCutsOnly ? "Tampilkan Semua Blok" : "Sorot Potongan Tepi"}
        </button>
      </div>

      <div
        ref={wrapRef}
        data-pp-stage
        className={css.canvasWrap}
        style={{ ["--ar" as string]: String(aspect), aspectRatio: "var(--ar)" }}
      >
        <canvas ref={canvasRef} className={css.svgStage} role="img" aria-label={summary} />
      </div>

      <div className={css.legendRow} data-pp-compact-hide>
        <span className={css.legendItem}>
          <span className={css.swatchStack}>
            {uniquePalette.map((color) => (
              <span key={color} className={css.legendSwatch} style={{ background: color }} />
            ))}
          </span>
          Blok utuh ({layout.metrics.fullCount.toLocaleString("id-ID")})
        </span>
        <span className={css.legendItem}>
          <span
            className={css.legendSwatch}
            style={{ background: palette[0], border: "1.5px solid #d63f12" }}
          />
          Potongan tepi ({layout.metrics.partialCount.toLocaleString("id-ID")})
        </span>
      </div>
    </div>
  );
}
