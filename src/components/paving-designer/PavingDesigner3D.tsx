"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { LayoutResult, LayoutTile } from "@/lib/paving/engine/types";
import type { ProjectGeometry } from "@/lib/paving/geometry/types";
import css from "./PavingDesigner.module.css";

interface Props {
  layout: LayoutResult;
  geometry?: ProjectGeometry;
  tebalCm?: number;
  showKanstin?: boolean;
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

/* Palet blok mengikuti palet produk pratinjau 2D: abu natural, merah, hitam. */
const ROLE_COLORS = ["#b5b4af", "#9c4a3a", "#2c2b29"];
const CUT_COLOR = "#c6c3ba";
const KANSTIN_COLOR = "#cdcac2";
const BED_COLOR = "#d8d2c6";
const SCENE_BG = "#e6e5df";
const JOINT_GAP_M = 0.006;

function isWebGLAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl2") ||
          canvas.getContext("webgl") ||
          canvas.getContext("experimental-webgl")),
    );
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
  // Ekstrusi berjalan di +Z; putar agar berdiri di +Y dan duduk di lantai y = 0.
  geo.rotateX(-Math.PI / 2);
  return geo;
}

export function PavingDesigner3D({ layout, geometry, tebalCm = 6, showKanstin = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasWebGL, setHasWebGL] = useState<boolean>(true);
  const [activePreset, setActivePreset] = useState<CameraPreset>("iso");
  const [isSampleMode, setIsSampleMode] = useState<boolean>(false);

  const presetRef = useRef<CameraPreset>("iso");
  const applyPresetRef = useRef<((preset: CameraPreset) => void) | null>(null);

  useEffect(() => {
    if (!isWebGLAvailable()) setHasWebGL(false);
  }, []);

  // Tombol kamera hanya menggeser kamera; scene tidak dibangun ulang.
  useEffect(() => {
    presetRef.current = activePreset;
    applyPresetRef.current?.(activePreset);
  }, [activePreset]);

  useEffect(() => {
    if (!hasWebGL || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 440;
    const tebalM = Math.max(0.02, (tebalCm || 6) / 100);

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

    // Bidang acuan (pasir/pemukaan) dibuat persegi dan selalu memuat lahan.
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

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
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
    controls.minDistance = fitRadius * 0.6;
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

    // 5. Pencahayaan netral, hangat, tanpa warna biru bawaan
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

    // 7a. Blok utuh — satu InstancedMesh per bentuk keping.
    // Satu motif bisa memuat lebih dari satu ukuran keping (mis. anyaman dan
    // tulang ikan), jadi blok dikelompokkan per bentuk agar tidak saling menimpa.
    if (fullToRender.length > 0) {
      const groups = new Map<string, { representative: PlanPoint[]; tiles: LayoutTile[] }>();

      for (const tile of fullToRender) {
        const ring = normalizeRing(tile.polygon);
        const b = bboxOf(ring);
        const cx = (b.minX + b.maxX) / 2;
        const cy = (b.minY + b.maxY) / 2;
        // Kunci diurutkan supaya keping yang identik tetap satu kelompok
        // walaupun titik awalnya berbeda; urutan asli tetap dipakai untuk bentuk.
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
          color.set(ROLE_COLORS[tile.role] ?? ROLE_COLORS[0]);
          instanced.setColorAt(i, color);
        });

        instanced.instanceMatrix.needsUpdate = true;
        if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
        pavingGroup.add(instanced);
      }
    }

    // 7b. Potongan tepi — bentuk persis hasil clipping, posisi sama dengan blok utuh
    if (!needsSampling && cutTiles.length > 0) {
      const cutMaterial = new THREE.MeshStandardMaterial({
        color: CUT_COLOR,
        roughness: 0.9,
        metalness: 0,
      });

      for (const cut of cutTiles) {
        const geometry3d = extrudeUp(toPlanShape(normalizeRing(cut.polygon), 0, 0), tebalM);
        const mesh = new THREE.Mesh(geometry3d, cutMaterial);
        mesh.position.set(-centerX, 0, -centerZ);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        pavingGroup.add(mesh);
      }
    }

    // 7c. Kanstin mengikuti garis batas lahan (bukan kotak pembungkus),
    // supaya lahan bentuk L/U tidak tertutup kanstin di area kosong.
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
        const ccw = signedArea(points) > 0;
        const flipNormal = isExterior ? !ccw : ccw;

        for (let i = 0; i < points.length; i++) {
          const a = points[i];
          const b = points[(i + 1) % points.length];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy);
          if (len < 1e-4) continue;

          // Normal luar untuk ring CCW adalah (dy, -dx); ring lubang dibalik.
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

    // 8. Render loop
    let isDisposed = false;
    let frameId = 0;
    const animate = () => {
      if (isDisposed) return;
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 9. Ukuran mengikuti panel, bukan hanya jendela
    const resize = () => {
      if (isDisposed || !containerRef.current) return;
      const w = containerRef.current.clientWidth || width;
      const h = containerRef.current.clientHeight || height;
      if (w <= 0 || h <= 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(container);
    window.addEventListener("resize", resize);

    // 10. Cleanup
    return () => {
      isDisposed = true;
      applyPresetRef.current = null;
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frameId);
      controls.dispose();

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.forEach((material) => material?.dispose());
        }
      });

      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [layout, geometry, tebalCm, showKanstin, hasWebGL]);

  if (!hasWebGL) {
    return (
      <div className={css.panel}>
        <div className={css.panelHeader}>
          <h3 className={css.panelTitle}>Visualisasi 3D Lahan</h3>
        </div>
        <div className={css.errorAlert}>
          <strong>WebGL tidak aktif.</strong> Peramban atau perangkat ini tidak mendukung
          akselerasi grafis 3D. Silakan gunakan tab <strong>2D Denah Tampak Atas</strong> — jumlah
          blok, potongan, dan estimasi material tetap sama.
        </div>
      </div>
    );
  }

  return (
    <div className={css.panel}>
      <div className={css.panelHeader}>
        <div>
          <h3 className={css.panelTitle}>Visualisasi 3D Lahan</h3>
          <span className={css.statLabel}>Seret untuk memutar · gulir untuk zoom</span>
        </div>
        <div className={css.previewTools} role="group" aria-label="Sudut kamera 3D">
          {CAMERA_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`${css.toggleBtn} ${activePreset === preset.id ? css.toggleActive : ""}`}
              aria-pressed={activePreset === preset.id}
              onClick={() => setActivePreset(preset.id)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {isSampleMode && (
        <div className={css.warningList}>
          <p className={css.warningText}>
            ⚡ <strong>Mode sampel 3D:</strong> lahan melebihi 10.000 keping, jadi yang digambar
            hanya sebagian zona. Perhitungan material di panel bawah tetap penuh untuk seluruh lahan.
          </p>
        </div>
      )}

      <div ref={containerRef} className={css.canvas3D} aria-label="Pratinjau paving tiga dimensi" />

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
