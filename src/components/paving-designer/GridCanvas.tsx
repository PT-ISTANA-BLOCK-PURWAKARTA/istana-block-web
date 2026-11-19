"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { multiPolygonArea, multiPolygonBounds, multiPolygonPerimeter } from "@/lib/paving/geometry/area";
import type { Point2D, ProjectGeometry } from "@/lib/paving/geometry/types";
import { validateGeometry } from "@/lib/paving/geometry/validate";
import {
  DEFAULT_VIEW,
  MIN_POLYGON_POINTS,
  clampCoord,
  fitToPoints,
  fracToWorld,
  gridLineValues,
  gridReducer,
  gridStep,
  initialGridState,
  nearestPointIndex,
  panByFrac,
  pinchView,
  snapValue,
  toClosedRing,
  zoomAt,
  type Frac,
  type GridView,
} from "@/lib/paving/grid-model";
import { IconAlert, IconCheck, IconTrash, IconUndo } from "./Icons";
import css from "./PavingDesigner.module.css";
import type { SiteInputStatus } from "./site-status";

interface Props {
  onGeometryChange: (geom: ProjectGeometry) => void;
  /** Dikabarkan saat bentuk sedang diubah / belum valid, agar hasil lama tidak dianggap segar. */
  onStatusChange?: (status: SiteInputStatus) => void;
}

const SNAP_OPTIONS = [
  { v: 0.25, label: "0,25 m" },
  { v: 0.5, label: "0,5 m" },
  { v: 1, label: "1 m" },
];

/** Radius sentuh titik (piksel CSS): jari lebih lebar daripada kursor. */
const HIT_PX_TOUCH = 26;
const HIT_PX_MOUSE = 14;
/** Gerakan minimum (piksel) sebelum ketukan dianggap seret/geser. */
const DRAG_THRESHOLD_PX = 6;
const ZOOM_STEP = 1.4;
const KEY_ZOOM = 1.25;
/** Perkiraan lebar kanvas sebelum diukur (piksel). */
const FALLBACK_CANVAS_PX = 340;

const fmtM = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 2 });

type Gesture =
  | { kind: "none" }
  | { kind: "pending"; startX: number; startY: number; hitIndex: number; startView: GridView }
  | { kind: "drag"; index: number }
  | { kind: "pan"; startX: number; startY: number; startView: GridView }
  | { kind: "pinch"; startView: GridView; startMid: Frac; startDist: number };

type BuildResult = { ok: true; geom: ProjectGeometry } | { ok: false; error: string };

function buildGridGeometry(points: readonly Point2D[]): BuildResult {
  const mp = [[toClosedRing(points)]];
  const val = validateGeometry(mp);
  if (!val.valid) return { ok: false, error: val.errors.join("; ") };
  const bounds = multiPolygonBounds(mp);
  const areaM2 = Math.round(multiPolygonArea(mp) * 1e6) / 1e6;
  const perimeterM = Math.round(multiPolygonPerimeter(mp) * 1e6) / 1e6;
  return {
    ok: true,
    geom: {
      schemaVersion: "1.0.0",
      source: "grid",
      sourceCrs: "local-meter",
      workingUnit: "meter",
      geometry: mp,
      metrics: { areaM2, perimeterM, bounds },
      warnings: val.warnings,
    },
  };
}

export function GridCanvas({ onGeometryChange, onStatusChange }: Props) {
  const [state, dispatch] = useReducer(gridReducer, initialGridState);
  const [view, setView] = useState<GridView>(DEFAULT_VIEW);
  const [gridSnap, setGridSnap] = useState(0.5);
  const [hoverPt, setHoverPt] = useState<Point2D | null>(null);
  const [cursor, setCursor] = useState<Point2D | null>(null);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [canvasPx, setCanvasPx] = useState(FALLBACK_CANVAS_PX);
  const [commitTick, setCommitTick] = useState(0);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const stateRef = useRef(state);
  stateRef.current = state;
  const snapRef = useRef(gridSnap);
  snapRef.current = gridSnap;
  const geomCbRef = useRef(onGeometryChange);
  geomCbRef.current = onGeometryChange;
  const statusCbRef = useRef(onStatusChange);
  statusCbRef.current = onStatusChange;

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture>({ kind: "none" });
  const dragging = useRef(false);
  const wasClosed = useRef(false);

  const { points, closed, selected } = state;

  /* ---------- Ukuran kanvas (untuk menskalakan ukuran penanda) ---------- */
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 0) setCanvasPx(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ---------- Zoom dengan Ctrl/Cmd + roda (tanpa merebut gulir halaman) ---------- */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const anchor: Frac = [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height];
      setView((v) => zoomAt(v, e.deltaY > 0 ? ZOOM_STEP : 1 / ZOOM_STEP, anchor));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /* ---------- Kirim geometri bila poligon tertutup & valid ---------- */
  useEffect(() => {
    if (dragging.current) return;
    if (!closed) {
      if (wasClosed.current) statusCbRef.current?.("invalid");
      wasClosed.current = false;
      return;
    }
    wasClosed.current = true;
    const built = buildGridGeometry(points);
    if (!built.ok) {
      setError(built.error);
      statusCbRef.current?.("invalid");
      return;
    }
    setError(null);
    geomCbRef.current(built.geom);
  }, [closed, points, commitTick]);

  /* ---------- Koordinat ---------- */
  const fracOf = useCallback((clientX: number, clientY: number): Frac | null => {
    const el = svgRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    return [(clientX - r.left) / r.width, (clientY - r.top) / r.height];
  }, []);

  const snapPoint = useCallback((w: Point2D): Point2D => {
    const s = snapRef.current;
    return [clampCoord(snapValue(w[0], s)), clampCoord(snapValue(w[1], s))];
  }, []);

  const pxPerMeter = useCallback(() => {
    const el = svgRef.current;
    const w = el ? el.getBoundingClientRect().width : FALLBACK_CANVAS_PX;
    return Math.max(1, w) / viewRef.current.span;
  }, []);

  /* ---------- Aksi tingkat tinggi ---------- */
  const say = (msg: string) => setAnnounce(msg);

  const tryClose = useCallback(() => {
    const pts = stateRef.current.points;
    if (pts.length < MIN_POLYGON_POINTS) {
      setError("Masukkan minimal 3 titik sudut sebelum menutup bentuk.");
      return;
    }
    const built = buildGridGeometry(pts);
    if (!built.ok) {
      setError(built.error);
      return;
    }
    setError(null);
    dispatch({ type: "close" });
    setAnnounce("Bentuk lahan ditutup dan siap dihitung.");
  }, []);

  /** Ketuk/Enter pada titik dunia `w`: tutup, pilih, atau tambah titik. */
  const placeAt = useCallback(
    (w: Point2D, hitIndex: number) => {
      const s = stateRef.current;
      if (hitIndex === 0 && !s.closed && s.points.length >= MIN_POLYGON_POINTS) {
        tryClose();
        return;
      }
      if (hitIndex >= 0) {
        const next = s.selected === hitIndex ? null : hitIndex;
        dispatch({ type: "select", index: next });
        say(next === null ? "Pilihan titik dibatalkan." : `Titik ${hitIndex + 1} dipilih. Seret untuk menggeser atau tekan Hapus.`);
        return;
      }
      if (s.closed) return;
      const pt = snapPoint(w);
      setError(null);
      dispatch({ type: "add", pt });
      say(`Titik ${s.points.length + 1} ditambahkan pada X ${fmtM(pt[0])} m, Y ${fmtM(pt[1])} m.`);
    },
    [snapPoint, tryClose],
  );

  const removeSelectedOrLast = useCallback(() => {
    const s = stateRef.current;
    if (s.points.length === 0) return;
    const index = s.selected ?? s.points.length - 1;
    dispatch({ type: "remove", index });
    setError(null);
    say(`Titik ${index + 1} dihapus.`);
  }, []);

  const undo = useCallback(() => {
    if (stateRef.current.past.length === 0) return;
    dispatch({ type: "undo" });
    setError(null);
    say("Langkah terakhir dibatalkan.");
  }, []);

  const zoomBy = useCallback((factor: number) => setView((v) => zoomAt(v, factor)), []);
  const fit = useCallback(() => setView(fitToPoints(stateRef.current.points)), []);

  /* ---------- Pointer events (mouse, sentuh, pena) ---------- */
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const f = fracOf(e.clientX, e.clientY);
    if (!f) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pointer capture tidak wajib */
    }
    wrapRef.current?.focus({ preventScroll: true });
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size >= 2) {
      // Dua jari: cubit-zoom + geser. Batalkan seret titik yang mungkin sedang berjalan.
      if (gesture.current.kind === "drag") {
        dragging.current = false;
        setCommitTick((n) => n + 1);
      }
      const [a, b] = [...pointers.current.values()];
      const fa = fracOf(a.x, a.y);
      const fb = fracOf(b.x, b.y);
      if (fa && fb) {
        gesture.current = {
          kind: "pinch",
          startView: viewRef.current,
          startMid: [(fa[0] + fb[0]) / 2, (fa[1] + fb[1]) / 2],
          startDist: Math.hypot(fa[0] - fb[0], fa[1] - fb[1]),
        };
      }
      return;
    }

    const hitPx = e.pointerType === "mouse" ? HIT_PX_MOUSE : HIT_PX_TOUCH;
    const raw = fracToWorld(viewRef.current, f);
    const hitIndex = nearestPointIndex(stateRef.current.points, raw, hitPx / pxPerMeter());
    gesture.current = { kind: "pending", startX: e.clientX, startY: e.clientY, hitIndex, startView: viewRef.current };
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const f = fracOf(e.clientX, e.clientY);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerType === "mouse" && f && gesture.current.kind === "none") {
      setHoverPt(snapPoint(fracToWorld(viewRef.current, f)));
    }

    const g = gesture.current;
    if (g.kind === "pinch") {
      const vals = [...pointers.current.values()];
      if (vals.length < 2) return;
      const fa = fracOf(vals[0].x, vals[0].y);
      const fb = fracOf(vals[1].x, vals[1].y);
      if (!fa || !fb) return;
      const mid: Frac = [(fa[0] + fb[0]) / 2, (fa[1] + fb[1]) / 2];
      setView(pinchView(g.startView, g.startMid, g.startDist, mid, Math.hypot(fa[0] - fb[0], fa[1] - fb[1])));
      return;
    }
    if (g.kind === "pending") {
      if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < DRAG_THRESHOLD_PX) return;
      if (g.hitIndex >= 0) {
        dragging.current = true;
        dispatch({ type: "moveStart" });
        if (stateRef.current.closed) statusCbRef.current?.("editing");
        gesture.current = { kind: "drag", index: g.hitIndex };
      } else {
        gesture.current = { kind: "pan", startX: g.startX, startY: g.startY, startView: g.startView };
      }
    }
    const cur = gesture.current;
    if (cur.kind === "drag" && f) {
      dispatch({ type: "move", index: cur.index, pt: snapPoint(fracToWorld(viewRef.current, f)) });
    } else if (cur.kind === "pan") {
      const el = svgRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setView(panByFrac(cur.startView, (e.clientX - cur.startX) / r.width, (e.clientY - cur.startY) / r.height));
    }
  };

  const endPointer = (e: React.PointerEvent<SVGSVGElement>, cancelled: boolean) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g.kind === "pinch") {
      if (pointers.current.size < 2) gesture.current = { kind: "none" };
      return;
    }
    if (g.kind === "pending" && !cancelled) {
      const f = fracOf(e.clientX, e.clientY);
      if (f) placeAt(fracToWorld(viewRef.current, f), g.hitIndex);
    } else if (g.kind === "drag") {
      dragging.current = false;
      setCommitTick((n) => n + 1);
    }
    gesture.current = { kind: "none" };
  };

  /* ---------- Papan ketik (aksesibilitas dasar) ---------- */
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const mod = e.ctrlKey || e.metaKey;
    const step = snapRef.current * (e.shiftKey ? 5 : 1);
    const s = stateRef.current;
    const arrow: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };

    if (mod && (e.key === "z" || e.key === "Z")) {
      e.preventDefault();
      undo();
      return;
    }
    if (e.key in arrow) {
      e.preventDefault();
      const [dx, dy] = arrow[e.key];
      if (s.selected !== null) {
        const p = s.points[s.selected];
        dispatch({ type: "moveStart" });
        dispatch({ type: "move", index: s.selected, pt: [clampCoord(snapValue(p[0] + dx, snapRef.current)), clampCoord(snapValue(p[1] + dy, snapRef.current))] });
        setCommitTick((n) => n + 1);
        return;
      }
      const base = cursor ?? snapPoint([viewRef.current.cx, viewRef.current.cy]);
      const next: Point2D = [clampCoord(snapValue(base[0] + dx, snapRef.current)), clampCoord(snapValue(base[1] + dy, snapRef.current))];
      setCursor(next);
      setHoverPt(next);
      const v = viewRef.current;
      if (Math.abs(next[0] - v.cx) > v.span / 2 || Math.abs(next[1] - v.cy) > v.span / 2) {
        setView({ ...v, cx: next[0], cy: next[1] });
      }
      return;
    }
    switch (e.key) {
      case "Enter":
      case " ": {
        e.preventDefault();
        const c = cursor ?? snapPoint([viewRef.current.cx, viewRef.current.cy]);
        setCursor(c);
        const hit = nearestPointIndex(s.points, c, snapRef.current / 2);
        placeAt(c, hit);
        return;
      }
      case "Delete":
      case "Backspace":
        e.preventDefault();
        removeSelectedOrLast();
        return;
      case "Escape":
        dispatch({ type: "select", index: null });
        return;
      case "[":
      case "]": {
        if (s.points.length === 0) return;
        const dir = e.key === "]" ? 1 : -1;
        const from = s.selected ?? (dir === 1 ? -1 : 0);
        const idx = (from + dir + s.points.length) % s.points.length;
        dispatch({ type: "select", index: idx });
        say(`Titik ${idx + 1} dari ${s.points.length} dipilih.`);
        return;
      }
      case "+":
      case "=":
        zoomBy(1 / KEY_ZOOM);
        return;
      case "-":
      case "_":
        zoomBy(KEY_ZOOM);
        return;
      case "0":
        fit();
        return;
      default:
    }
  };

  /* ---------- Gambar ---------- */
  const pxM = view.span / Math.max(120, canvasPx); // meter per piksel CSS
  const minX = view.cx - view.span / 2;
  const maxX = view.cx + view.span / 2;
  const minY = view.cy - view.span / 2;
  const maxY = view.cy + view.span / 2;
  const step = gridStep(view.span);
  const xs = useMemo(() => gridLineValues(minX, maxX, step), [minX, maxX, step]);
  const ys = useMemo(() => gridLineValues(minY, maxY, step), [minY, maxY, step]);
  const isMajor = (v: number) => Math.round(v / step) % 5 === 0;
  const sy = (y: number) => -y;
  const ptsAttr = points.map(([x, y]) => `${x},${sy(y)}`).join(" ");
  const last = points.length > 0 ? points[points.length - 1] : null;
  const ghost = !closed && last ? (hoverPt ?? (focused ? cursor : null)) : null;
  const cross = focused ? cursor : null;

  const headerText = closed
    ? "Bentuk lahan tertutup dan siap dihitung"
    : `Ketuk kanvas untuk menandai sudut (${points.length} titik)`;

  return (
    <div className={css.stack}>
      <div className={css.gridHeaderBar}>
        <span className={css.label}>{headerText}</span>
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

      <div
        ref={wrapRef}
        className={`${css.canvasWrap} ${css.gridWrap}`}
        style={{ aspectRatio: 1 }}
        tabIndex={0}
        role="group"
        aria-label="Kanvas gambar bentuk lahan. Panah menggeser kursor, Enter menambah titik, Delete menghapus titik, tanda kurung siku memilih titik, plus dan minus zoom, nol memusatkan, Ctrl+Z mengurungkan."
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <svg
          ref={svgRef}
          viewBox={`${minX} ${-maxY} ${view.span} ${view.span}`}
          className={`${css.svgStage} ${css.gridSvg}`}
          style={{ cursor: closed ? "default" : "crosshair" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endPointer(e, false)}
          onPointerCancel={(e) => endPointer(e, true)}
          onPointerLeave={() => setHoverPt(null)}
          aria-hidden="true"
        >
          <g>
            {xs.map((v) => (
              <line
                key={`gx_${v}`}
                x1={v}
                y1={-maxY}
                x2={v}
                y2={-minY}
                stroke={isMajor(v) ? "rgba(14, 42, 107, 0.22)" : "rgba(14, 42, 107, 0.08)"}
                strokeWidth={(isMajor(v) ? 1.6 : 1) * pxM}
              />
            ))}
            {ys.map((v) => (
              <line
                key={`gy_${v}`}
                x1={minX}
                y1={sy(v)}
                x2={maxX}
                y2={sy(v)}
                stroke={isMajor(v) ? "rgba(14, 42, 107, 0.22)" : "rgba(14, 42, 107, 0.08)"}
                strokeWidth={(isMajor(v) ? 1.6 : 1) * pxM}
              />
            ))}
            {xs.filter(isMajor).map((v) => (
              <text
                key={`tx_${v}`}
                x={v + 3 * pxM}
                y={-minY - 5 * pxM}
                fontSize={11 * pxM}
                fill="rgba(14, 42, 107, 0.7)"
                stroke="#fff"
                strokeWidth={3 * pxM}
                paintOrder="stroke"
              >
                {fmtM(v)} m
              </text>
            ))}
            {ys.filter(isMajor).map((v) => (
              <text
                key={`ty_${v}`}
                x={minX + 4 * pxM}
                y={sy(v) - 4 * pxM}
                fontSize={11 * pxM}
                fill="rgba(14, 42, 107, 0.7)"
                stroke="#fff"
                strokeWidth={3 * pxM}
                paintOrder="stroke"
              >
                {fmtM(v)} m
              </text>
            ))}
          </g>

          {closed && points.length >= 3 && (
            <polygon
              points={ptsAttr}
              fill={error ? "rgba(214, 63, 18, 0.14)" : "rgba(37, 65, 134, 0.14)"}
              stroke={error ? "#d63f12" : "var(--biru, #254186)"}
              strokeWidth={2.6 * pxM}
              strokeLinejoin="round"
            />
          )}

          {!closed && points.length > 1 && (
            <polyline
              points={ptsAttr}
              fill="none"
              stroke="var(--biru, #254186)"
              strokeWidth={2.4 * pxM}
              strokeLinejoin="round"
            />
          )}

          {ghost && last && (
            <line
              x1={last[0]}
              y1={sy(last[1])}
              x2={ghost[0]}
              y2={sy(ghost[1])}
              stroke="rgba(37, 65, 134, 0.55)"
              strokeWidth={1.6 * pxM}
              strokeDasharray={`${5 * pxM} ${3.5 * pxM}`}
            />
          )}

          {cross && (
            <g stroke="var(--oranye, #fe5722)" strokeWidth={1.6 * pxM}>
              <line x1={cross[0] - 9 * pxM} y1={sy(cross[1])} x2={cross[0] + 9 * pxM} y2={sy(cross[1])} />
              <line x1={cross[0]} y1={sy(cross[1]) - 9 * pxM} x2={cross[0]} y2={sy(cross[1]) + 9 * pxM} />
            </g>
          )}

          {points.map(([x, y], idx) => {
            const isFirst = idx === 0;
            const isSel = selected === idx;
            return (
              <g key={`pt_${idx}`}>
                {isSel && (
                  <circle cx={x} cy={sy(y)} r={14 * pxM} fill="rgba(254, 87, 34, 0.16)" stroke="var(--oranye, #fe5722)" strokeWidth={1.8 * pxM} />
                )}
                <circle
                  cx={x}
                  cy={sy(y)}
                  r={(isFirst ? 8.5 : 6.5) * pxM}
                  fill={isFirst ? "var(--oranye, #fe5722)" : "var(--biru, #254186)"}
                  stroke="#fff"
                  strokeWidth={1.6 * pxM}
                />
              </g>
            );
          })}
        </svg>

        <div className={css.gridTools} data-pp-noprint>
          <button type="button" className={css.gridToolBtn} onClick={() => zoomBy(1 / ZOOM_STEP)} aria-label="Perbesar kanvas">
            +
          </button>
          <button type="button" className={css.gridToolBtn} onClick={() => zoomBy(ZOOM_STEP)} aria-label="Perkecil kanvas">
            −
          </button>
          <button type="button" className={css.gridToolBtn} onClick={fit} aria-label="Pusatkan kanvas pada bentuk">
            ◎
          </button>
        </div>

        <div className={css.scaleBadge}>
          {hoverPt
            ? `X: ${fmtM(hoverPt[0])} m · Y: ${fmtM(hoverPt[1])} m`
            : `Kanvas: ${fmtM(view.span)} × ${fmtM(view.span)} m · grid ${fmtM(step)} m`}
        </div>
      </div>

      <p className={css.gridHint}>
        Ketuk untuk menandai sudut, seret titik untuk menggeser. Geser latar dengan satu jari, cubit dua jari untuk zoom
        (di laptop: Ctrl + roda). Ketuk titik untuk memilihnya, lalu hapus.
      </p>

      <div className={css.mapActions}>
        {!closed && points.length >= MIN_POLYGON_POINTS && (
          <button type="button" className="btn btn-blue btn-sm" onClick={tryClose}>
            <IconCheck size={15} />
            <span>Tutup Poligon</span>
          </button>
        )}
        {state.past.length > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={undo}>
            <IconUndo size={15} />
            <span>Urungkan</span>
          </button>
        )}
        {points.length > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={removeSelectedOrLast}>
            <IconTrash size={15} />
            <span>{selected !== null ? "Hapus titik terpilih" : "Hapus titik terakhir"}</span>
          </button>
        )}
        {points.length > 0 && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              dispatch({ type: "reset" });
              setError(null);
              say("Semua titik dihapus.");
            }}
          >
            <span>Ulangi</span>
          </button>
        )}
      </div>

      <p className={css.srOnly} role="status" aria-live="polite">
        {announce}
      </p>

      {error && (
        <div className={css.warningBox} role="alert">
          <IconAlert size={17} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
