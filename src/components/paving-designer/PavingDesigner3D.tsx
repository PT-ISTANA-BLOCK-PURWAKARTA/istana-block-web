"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { LayoutResult, LayoutTile } from "@/lib/paving/engine/types";
import type { ProjectGeometry } from "@/lib/paving/geometry/types";
import { IconAlert, IconCollapse, IconExpand } from "./Icons";
import css from "./PavingDesigner.module.css";

interface Props {
  layout: LayoutResult;
  geometry?: ProjectGeometry;
  tebalCm?: number;
  showKanstin?: boolean;
  roleColors?: string[];
  onSwitchTo2D?: () => void;
}

type CameraPreset = "iso" | "jalan" | "atas";

interface PlanPoint {
  x: number;
  y: number;
}

interface Box2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const MAX_3D_BLOCKS = 10000;

const CAMERA_PRESETS: Array<{ id: CameraPreset; label: string }> = [
  { id: "iso", label: "Isometrik" },
  { id: "jalan", label: "Perspektif" },
  { id: "atas", label: "Tampak Atas" },
];

/* Palet blok default mengikuti palet produk pratinjau 2D Istana Block: abu natural, merah, hitam. */
const DEFAULT_ROLE_COLORS = ["#b5b4af", "#9c4a3a", "#2c2b29"];
const CUT_COLOR = "#c6c3ba";
const KANSTIN_COLOR = "#cdcac2";
const BED_COLOR = "#d8d2c6";
const SCENE_BG = "#e6e5df";
const JOINT_GAP_M = 0.006;

function isWebGLAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl"));
    if (!gl) return false;
    // Lepas konteks uji segera agar tidak menghabiskan kuota konteks GPU browser
    const ext = (gl as WebGLRenderingContext).getExtension?.("WEBGL_lose_context");
    ext?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function bboxOf(points: PlanPoint[]): Box2D {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/** Buang titik penutup ganda agar poligon bisa dikenali sebagai persegi 4 titik. */
function normalizeRing(points: PlanPoint[]): PlanPoint[] {
  const ring: PlanPoint[] = [];
  for (const p of points) {
    const last = ring[ring.length - 1];
    if (last && Math.abs(last.x - p.x) < 1e-6 && Math.abs(last.y - p.y) < 1e-6) continue;
    ring.push({ x: p.x, y: p.y });
  }
  if (ring.length > 1) {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (Math.abs(first.x - last.x) < 1e-6 && Math.abs(first.y - last.y) < 1e-6) ring.pop();
  }
  return ring;
}

/** Luas bertanda: positif = berlawanan arah jarum jam (CCW). */
function signedArea(points: PlanPoint[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

/**
 * Keping utuh hanya bisa digambar sebagai kotak bila poligonnya persegi sejajar
 * sumbu. Pola diagonal 45° dan hexagon harus memakai bentuk aslinya.
 */
function axisAlignedRect(points: PlanPoint[]): { w: number; l: number } | null {
  if (points.length !== 4) return null;
  const b = bboxOf(points);
  const w = b.maxX - b.minX;
  const l = b.maxY - b.minY;
  if (w <= 0 || l <= 0) return null;

  const area = Math.abs(signedArea(points));
  if (Math.abs(area - w * l) > w * l * 0.002) return null;

  const tol = Math.max(w, l) * 0.001;
  for (const p of points) {
    const onX = Math.abs(p.x - b.minX) <= tol || Math.abs(p.x - b.maxX) <= tol;
    const onY = Math.abs(p.y - b.minY) <= tol || Math.abs(p.y - b.maxY) <= tol;
    if (!onX || !onY) return null;
  }
  return { w, l };
}

/**
 * THREE.Shape dari poligon plan. Sumbu plan-Y dibalik agar setelah
 * `rotateX(-Math.PI / 2)` koordinat plan-Y jatuh tepat di sumbu +Z dunia,
 * sama dengan penempatan blok utuh — tanpa ini potongan tepi tampil ter-mirror.
 */
function toPlanShape(points: PlanPoint[], originX: number, originY: number): THREE.Shape {
  const shape = new THREE.Shape();
  points.forEach((p, i) => {
    const x = p.x - originX;
    const y = -(p.y - originY);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  return shape;
}

function extrudeUp(shape: THREE.Shape, heightM: number): THREE.ExtrudeGeometry {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: heightM,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 1,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

export function PavingDesigner3D({
  layout,
  geometry,
  tebalCm = 6,
  showKanstin = true,
  roleColors,
  onSwitchTo2D,
}: Props) {
  const palette = roleColors && roleColors.length > 0 ? roleColors : DEFAULT_ROLE_COLORS;
  const paletteKey = palette.join(",");
  const uniquePalette = Array.from(new Set(palette));
  const wrapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasWebGL, setHasWebGL] = useState<boolean>(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<CameraPreset>("iso");
  const [isSampleMode, setIsSampleMode] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const presetRef = useRef<CameraPreset>("iso");
  const applyPresetRef = useRef<((preset: CameraPreset) => void) | null>(null);

  useEffect(() => {
    if (!isWebGLAvailable()) setHasWebGL(false);
  }, []);

  useEffect(() => {
    presetRef.current = activePreset;
    applyPresetRef.current?.(activePreset);
  }, [activePreset]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    const el = wrapRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement && el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      } else {
        setIsFullscreen((v) => !v);
      }
    } catch {
      setIsFullscreen((v) => !v);
    }
  };

  useEffect(() => {
    if (!hasWebGL || !containerRef.current) return;

    setRenderError(null);
    setContextLost(false);

    const container = containerRef.current;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 400;
    const tebalM = Math.max(0.02, (tebalCm || 6) / 100);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch (err: any) {
      setRenderError(
        err?.message || "Konteks WebGL 3D tidak dapat diinisialisasi pada peramban ini.",
      );
      return;
    }

    // 1. Batas lahan
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const tile of layout.tiles) {
      for (const p of tile.polygon) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
    }

    if (!Number.isFinite(minX)) {
      const b = geometry?.metrics.bounds;
      minX = b?.minX ?? 0;
      maxX = b?.maxX ?? 10;
      minY = b?.minY ?? 0;
      maxY = b?.maxY ?? 5;
    }

    const centerX = (minX + maxX) / 2;
    const centerZ = (minY + maxY) / 2;
    const spanX = Math.max(1, maxX - minX);
    const spanZ = Math.max(1, maxY - minY);
    const maxSpan = Math.max(spanX, spanZ);
    const bedSize = maxSpan + Math.max(6, maxSpan * 0.6);

    // 2. Scene & kamera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SCENE_BG);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    const fitRadius = Math.max(1.5, Math.hypot(spanX, spanZ) / 2);
    const fitDist =
      (fitRadius * 1.18) / Math.sin(THREE.MathUtils.degToRad(camera.fov) * 0.5);
    camera.near = Math.max(0.05, fitDist * 0.01);
    camera.far = fitDist * 8;
    camera.updateProjectionMatrix();

    // 3. Renderer setup
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // 4. Kontrol orbit
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = fitRadius * 0.55;
    controls.maxDistance = fitDist * 2.6;
    controls.target.set(0, tebalM / 2, 0);

    const presetDirection = (preset: CameraPreset) => {
      if (preset === "jalan") return new THREE.Vector3(0.08, 0.3, 1).normalize();
      if (preset === "atas") return new THREE.Vector3(0, 1, 0.0001).normalize();
      return new THREE.Vector3(0.9, 0.78, 1.05).normalize();
    };

    const applyPreset = (preset: CameraPreset) => {
      const target = new THREE.Vector3(0, tebalM / 2, 0);
      controls.target.copy(target);
      camera.position.copy(target).addScaledVector(presetDirection(preset), fitDist);
      controls.update();
    };

    applyPreset(presetRef.current);
    applyPresetRef.current = applyPreset;

    // 5. Pencahayaan netral hangat
    scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc8ba, 0.85));

    const sun = new THREE.DirectionalLight(0xffffff, 1.25);
    sun.position.set(maxSpan * 0.9, maxSpan * 1.5, maxSpan * 0.55);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const shadowCamera = sun.shadow.camera;
    shadowCamera.left = -maxSpan;
    shadowCamera.right = maxSpan;
    shadowCamera.top = maxSpan;
    shadowCamera.bottom = -maxSpan;
    shadowCamera.near = 0.5;
    shadowCamera.far = maxSpan * 6;
    shadowCamera.updateProjectionMatrix();
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);

    // 6. Bidang dasar
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(bedSize, bedSize),
      new THREE.MeshStandardMaterial({ color: BED_COLOR, roughness: 1, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.012;
    ground.receiveShadow = true;
    scene.add(ground);

    // 7. Paving
    const pavingGroup = new THREE.Group();
    scene.add(pavingGroup);

    const fullTiles: LayoutTile[] = [];
    const cutTiles: LayoutTile[] = [];
    for (const tile of layout.tiles) {
      if (tile.status === "full") fullTiles.push(tile);
      else cutTiles.push(tile);
    }

    const needsSampling = layout.tiles.length > MAX_3D_BLOCKS;
    setIsSampleMode(needsSampling);
    const fullToRender = needsSampling ? fullTiles.slice(0, MAX_3D_BLOCKS) : fullTiles;

    try {
      // 7a. Blok utuh — dikelompokkan per bentuk agar motif hexagon/diagonal akurat
      if (fullToRender.length > 0) {
        const groups = new Map<string, { representative: PlanPoint[]; tiles: LayoutTile[] }>();

        for (const tile of fullToRender) {
          const ring = normalizeRing(tile.polygon);
          if (ring.length < 3 || Math.abs(signedArea(ring)) < 1e-6) continue;

          const b = bboxOf(ring);
          const cx = (b.minX + b.maxX) / 2;
          const cy = (b.minY + b.maxY) / 2;
          const key = ring
            .map((p) => `${Math.round((p.x - cx) * 1000)}:${Math.round((p.y - cy) * 1000)}`)
            .sort()
            .join("|");
          const group = groups.get(key);
          if (group) group.tiles.push(tile);
          else groups.set(key, { representative: ring, tiles: [tile] });
        }

        for (const { representative, tiles } of groups.values()) {
          const repBox = bboxOf(representative);
          const repCx = (repBox.minX + repBox.maxX) / 2;
          const repCy = (repBox.minY + repBox.maxY) / 2;
          const rect = axisAlignedRect(representative);

          let geometry3d: THREE.BufferGeometry;
          let yBase: number;

          if (rect) {
            geometry3d = new THREE.BoxGeometry(
              Math.max(0.02, rect.w - JOINT_GAP_M),
              tebalM,
              Math.max(0.02, rect.l - JOINT_GAP_M),
            );
            yBase = tebalM / 2;
          } else {
            geometry3d = extrudeUp(toPlanShape(representative, repCx, repCy), tebalM);
            yBase = 0;
          }

          const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.86,
            metalness: 0,
          });

          const instanced = new THREE.InstancedMesh(geometry3d, material, tiles.length);
          instanced.castShadow = true;
          instanced.receiveShadow = true;

          const dummy = new THREE.Object3D();
          const color = new THREE.Color();

          tiles.forEach((tile, i) => {
            const b = bboxOf(tile.polygon);
            dummy.position.set(
              (b.minX + b.maxX) / 2 - centerX,
              yBase,
              (b.minY + b.maxY) / 2 - centerZ,
            );
            dummy.rotation.set(0, 0, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            instanced.setMatrixAt(i, dummy.matrix);
            color.set(palette[tile.role] ?? palette[0]);
            instanced.setColorAt(i, color);
          });

          instanced.instanceMatrix.needsUpdate = true;
          if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
          pavingGroup.add(instanced);
        }
      }

      // 7b. Potongan tepi — bentuk persis hasil clipping
      if (!needsSampling && cutTiles.length > 0) {
        const cutMaterial = new THREE.MeshStandardMaterial({
          color: CUT_COLOR,
          roughness: 0.9,
          metalness: 0,
        });

        for (const cut of cutTiles) {
          const ring = normalizeRing(cut.polygon);
          if (ring.length < 3 || Math.abs(signedArea(ring)) < 1e-6) continue;
          const geometry3d = extrudeUp(toPlanShape(ring, 0, 0), tebalM);
          const mesh = new THREE.Mesh(geometry3d, cutMaterial);
          mesh.position.set(-centerX, 0, -centerZ);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          pavingGroup.add(mesh);
        }
      }

      // 7c. Kanstin mengikuti batas poligon lahan
      if (showKanstin) {
        const curbWidth = 0.12;
        const curbHeight = tebalM + 0.06;
        const curbY = curbHeight / 2 - 0.01;
        const curbMaterial = new THREE.MeshStandardMaterial({
          color: KANSTIN_COLOR,
          roughness: 0.9,
          metalness: 0,
        });

        const rings: Array<{ points: PlanPoint[]; isExterior: boolean }> = [];

        if (geometry?.geometry?.length) {
          for (const polygon of geometry.geometry) {
            polygon.forEach((ring, index) => {
              if (ring.length < 3) return;
              rings.push({
                points: ring.map(([x, y]) => ({ x, y })),
                isExterior: index === 0,
              });
            });
          }
        }

        if (rings.length === 0) {
          rings.push({
            points: [
              { x: minX, y: minY },
              { x: maxX, y: minY },
              { x: maxX, y: maxY },
              { x: minX, y: maxY },
            ],
            isExterior: true,
          });
        }

        for (const { points, isExterior } of rings) {
          const clean = normalizeRing(points);
          if (clean.length < 3) continue;
          const ccw = signedArea(clean) > 0;
          const flipNormal = isExterior ? !ccw : ccw;

          for (let i = 0; i < clean.length; i++) {
            const a = clean[i];
            const b = clean[(i + 1) % clean.length];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.hypot(dx, dy);
            if (len < 1e-4) continue;

            const nx = (flipNormal ? -dy : dy) / len;
            const ny = (flipNormal ? dx : -dx) / len;

            const mesh = new THREE.Mesh(
              new THREE.BoxGeometry(len + curbWidth, curbHeight, curbWidth),
              curbMaterial,
            );
            mesh.position.set(
              (a.x + b.x) / 2 + (nx * curbWidth) / 2 - centerX,
              curbY,
              (a.y + b.y) / 2 + (ny * curbWidth) / 2 - centerZ,
            );
            mesh.rotation.y = -Math.atan2(dy, dx);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            pavingGroup.add(mesh);
          }
        }
      }
    } catch (err: any) {
      setRenderError(err?.message || "Gagal menyusun geometri 3D untuk bentuk lahan ini.");
    }

    // 8. Penanganan kehilangan konteks WebGL (mis. GPU reset / tab latar belakang)
    let isDisposed = false;
    let isContextLost = false;
    let frameId = 0;

    const onContextLost = (e: Event) => {
      e.preventDefault();
      isContextLost = true;
      setContextLost(true);
      cancelAnimationFrame(frameId);
      frameId = 0;
    };

    const onContextRestored = () => {
      isContextLost = false;
      setContextLost(false);
      requestRender();
    };

    renderer.domElement.addEventListener("webglcontextlost", onContextLost, false);
    renderer.domElement.addEventListener("webglcontextrestored", onContextRestored, false);

    // 9. Render sesuai kebutuhan (bukan loop terus-menerus): hanya saat kamera/kontrol,
    //    ukuran, atau data berubah. Damping memicu event "change" sampai gerakan berhenti.
    const tick = () => {
      frameId = 0;
      if (isDisposed || isContextLost) return;
      controls.update();
      renderer.render(scene, camera);
    };
    function requestRender() {
      if (isDisposed || isContextLost || frameId !== 0) return;
      frameId = requestAnimationFrame(tick);
    }
    controls.addEventListener("change", requestRender);
    requestRender();

    // 10. Ukuran mengikuti kontainer
    const resize = () => {
      if (isDisposed || !containerRef.current) return;
      const w = containerRef.current.clientWidth || width;
      const h = containerRef.current.clientHeight || height;
      if (w <= 0 || h <= 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };

    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(container);
    window.addEventListener("resize", resize);

    // 11. Cleanup bersih tanpa bocor memori
    return () => {
      isDisposed = true;
      applyPresetRef.current = null;
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
      cancelAnimationFrame(frameId);
      controls.removeEventListener("change", requestRender);
      controls.dispose();

      const disposedMaterials = new Set<THREE.Material>();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const mat of materials) {
            if (mat && !disposedMaterials.has(mat)) {
              disposedMaterials.add(mat);
              mat.dispose();
            }
          }
        }
      });

      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [layout, geometry, tebalCm, showKanstin, hasWebGL, paletteKey]);

  if (!hasWebGL || renderError) {
    return (
      <div className={css.errorCard} role="alert">
        <div className={css.errorCardHead}>
          <span className={css.errorIconWrap}>
            <IconAlert size={20} />
          </span>
          <div>
            <strong className={css.errorCardTitle}>Pratinjau 3D tidak tersedia</strong>
            <p className={css.errorCardDesc}>
              {renderError ||
                "Peramban atau perangkat ini tidak mengaktifkan akselerasi WebGL 3D. Anda tetap bisa melihat denah akurat dan estimasi penuh pada tampilan 2D."}
            </p>
          </div>
        </div>
        {onSwitchTo2D && (
          <div className={css.errorCardActions}>
            <button type="button" className="btn btn-blue btn-sm" onClick={onSwitchTo2D}>
              Buka Denah 2D
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={css.stack}>
      {isSampleMode && (
        <div className={css.warningBox}>
          <IconAlert size={17} />
          <span>
            <strong>Mode sampel 3D:</strong> lahan melebihi 10.000 keping sehingga tampilan 3D
            menampilkan sebagian zona demi kelancaran perangkat. Estimasi material tetap penuh untuk
            seluruh lahan.
          </span>
        </div>
      )}

      {contextLost && (
        <div className={css.warningBox} role="status">
          <IconAlert size={17} />
          <span>
            Konteks grafis 3D sempat dijeda oleh peramban. Coba kembali ke tampilan 2D atau muat
            ulang bila layar tidak pulih.
          </span>
        </div>
      )}

      <div
        ref={wrapRef}
        className={`${css.stage3dWrap} ${isFullscreen ? css.stage3dFullscreen : ""}`}
      >
        <div className={css.overlayTop3D} role="group" aria-label="Kontrol kamera 3D">
          {CAMERA_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`${css.presetBtn3D} ${activePreset === preset.id ? css.presetBtn3DActive : ""}`}
              aria-pressed={activePreset === preset.id}
              onClick={() => setActivePreset(preset.id)}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            className={css.fullscreenBtn3D}
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Keluar layar penuh" : "Buka layar penuh"}
          >
            {isFullscreen ? <IconCollapse size={14} /> : <IconExpand size={14} />}
            <span>{isFullscreen ? "Tutup" : "Penuh"}</span>
          </button>
        </div>

        <div ref={containerRef} className={css.canvas3D} aria-label="Pratinjau paving tiga dimensi" />

        <div className={css.hint3D}>Seret untuk putar · gulir/cubit untuk zoom</div>
      </div>

      <div className={css.legendRow}>
        <span className={css.legendItem}>
          <span className={css.swatchStack}>
            {uniquePalette.map((color) => (
              <span key={color} className={css.legendSwatch} style={{ background: color }} />
            ))}
          </span>
          Blok utuh ({layout.metrics.fullCount.toLocaleString("id-ID")})
        </span>
        <span className={css.legendItem}>
          <span className={css.legendSwatch} style={{ background: CUT_COLOR }} />
          Potongan tepi ({layout.metrics.partialCount.toLocaleString("id-ID")})
        </span>
        {showKanstin && (
          <span className={css.legendItem}>
            <span className={css.legendSwatch} style={{ background: KANSTIN_COLOR }} />
            Kanstin beton
          </span>
        )}
      </div>
    </div>
  );
}

export default PavingDesigner3D;
