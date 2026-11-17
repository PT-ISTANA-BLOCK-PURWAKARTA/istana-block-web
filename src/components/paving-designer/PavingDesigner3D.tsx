"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { LayoutResult, LayoutTile } from "@/lib/paving/engine/types";
import css from "./PavingDesigner.module.css";

interface Props {
  layout: LayoutResult;
  tebalCm?: number;
  showKanstin?: boolean;
}

type CameraPreset = "iso" | "jalan" | "atas";

const MAX_3D_BLOCKS = 10000;

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

/**
 * Convert tile polygon points to THREE.Shape
 */
function tileToThreeShape(points: Array<{ x: number; y: number }>): THREE.Shape | null {
  if (!points || points.length < 3) return null;
  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i].x, points[i].y);
  }
  return shape;
}

export function PavingDesigner3D({ layout, tebalCm = 6, showKanstin = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasWebGL, setHasWebGL] = useState<boolean>(true);
  const [activePreset, setActivePreset] = useState<CameraPreset>("iso");
  const [isSampleMode, setIsSampleMode] = useState<boolean>(false);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Check WebGL availability on mount
  useEffect(() => {
    if (!isWebGLAvailable()) {
      setHasWebGL(false);
    }
  }, []);

  // Main Three.js Scene Setup & Render
  useEffect(() => {
    if (!hasWebGL || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 600;
    const height = 440;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f1f5f9");
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;

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
    rendererRef.current = renderer;

    // 4. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't dip below ground
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // 6. Compute Layout Bounds from Tiles
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const t of layout.tiles) {
      for (const p of t.polygon) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
    }

    if (!isFinite(minX)) {
      minX = 0;
      maxX = 10;
      minY = 0;
      maxY = 5;
    }

    const centerX = (minX + maxX) / 2;
    const centerZ = (minY + maxY) / 2;
    const spanX = Math.max(1, maxX - minX);
    const spanZ = Math.max(1, maxY - minY);
    const maxSpan = Math.max(spanX, spanZ);

    // Set initial camera pose based on preset
    const setCameraToPreset = (preset: CameraPreset) => {
      if (preset === "iso") {
        camera.position.set(centerX + maxSpan * 0.9, maxSpan * 0.8, centerZ + maxSpan * 0.9);
      } else if (preset === "jalan") {
        camera.position.set(centerX, maxSpan * 0.35, centerZ + maxSpan * 1.1);
      } else if (preset === "atas") {
        camera.position.set(centerX, maxSpan * 1.6, centerZ);
      }
      controls.target.set(0, 0, 0);
      camera.lookAt(0, 0, 0);
      controls.update();
    };

    setCameraToPreset(activePreset);

    // 7. Ground / Sub-base Sand Bed
    const groundGeo = new THREE.PlaneGeometry(spanX + 4, spanZ + 4);
    const groundMat = new THREE.MeshStandardMaterial({
      color: "#d9d2c9",
      roughness: 0.95,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.005, 0);
    ground.receiveShadow = true;
    scene.add(ground);

    // 8. Paving Blocks Group
    const pavingGroup = new THREE.Group();
    scene.add(pavingGroup);

    const tebalM = (tebalCm || 6) / 100;

    // Filter full vs partial cut tiles
    const fullTiles: LayoutTile[] = [];
    const cutTiles: LayoutTile[] = [];

    for (const t of layout.tiles) {
      if (t.status === "full") {
        fullTiles.push(t);
      } else {
        cutTiles.push(t);
      }
    }

    const totalBlocks = fullTiles.length + cutTiles.length;
    const needsSampling = totalBlocks > MAX_3D_BLOCKS;
    setIsSampleMode(needsSampling);

    const fullBlocksToRender = needsSampling
      ? fullTiles.slice(0, MAX_3D_BLOCKS)
      : fullTiles;

    // A. Render Full Blocks via InstancedMesh
    if (fullBlocksToRender.length > 0) {
      // Calculate representative box size from first full block
      const firstPoly = fullBlocksToRender[0].polygon;
      let fMinX = Infinity, fMaxX = -Infinity, fMinY = Infinity, fMaxY = -Infinity;
      for (const pt of firstPoly) {
        if (pt.x < fMinX) fMinX = pt.x;
        if (pt.x > fMaxX) fMaxX = pt.x;
        if (pt.y < fMinY) fMinY = pt.y;
        if (pt.y > fMaxY) fMaxY = pt.y;
      }
      const bw = Math.max(0.05, fMaxX - fMinX);
      const bl = Math.max(0.05, fMaxY - fMinY);

      const fullBoxGeo = new THREE.BoxGeometry(bw, tebalM, bl);
      const fullMat = new THREE.MeshStandardMaterial({
        color: "#c8c6be",
        roughness: 0.82,
        metalness: 0.02,
      });

      const instMesh = new THREE.InstancedMesh(fullBoxGeo, fullMat, fullBlocksToRender.length);
      instMesh.castShadow = true;
      instMesh.receiveShadow = true;

      const dummy = new THREE.Object3D();
      const tmpColor = new THREE.Color();
      const colorShades = ["#c8c6be", "#b5b3aa", "#8c3b31", "#333333"];

      for (let i = 0; i < fullBlocksToRender.length; i++) {
        const b = fullBlocksToRender[i];
        let tMinX = Infinity, tMaxX = -Infinity, tMinY = Infinity, tMaxY = -Infinity;
        for (const pt of b.polygon) {
          if (pt.x < tMinX) tMinX = pt.x;
          if (pt.x > tMaxX) tMaxX = pt.x;
          if (pt.y < tMinY) tMinY = pt.y;
          if (pt.y > tMaxY) tMaxY = pt.y;
        }

        const bCenterX = (tMinX + tMaxX) / 2;
        const bCenterZ = (tMinY + tMaxY) / 2;

        dummy.position.set(bCenterX - centerX, tebalM / 2, bCenterZ - centerZ);
        dummy.updateMatrix();
        instMesh.setMatrixAt(i, dummy.matrix);

        const shade = colorShades[b.role % colorShades.length];
        tmpColor.set(shade);
        instMesh.setColorAt(i, tmpColor);
      }

      instMesh.instanceMatrix.needsUpdate = true;
      if (instMesh.instanceColor) instMesh.instanceColor.needsUpdate = true;
      pavingGroup.add(instMesh);
    }

    // B. Render Cut Partial Blocks (ExtrudeGeometry per cut polygon)
    if (!needsSampling && cutTiles.length > 0) {
      const cutMat = new THREE.MeshStandardMaterial({
        color: "#b0aba2",
        roughness: 0.88,
        metalness: 0.02,
      });

      for (let i = 0; i < cutTiles.length; i++) {
        const cut = cutTiles[i];
        const shape = tileToThreeShape(cut.polygon);
        if (!shape) continue;

        const cutGeo = new THREE.ExtrudeGeometry(shape, {
          depth: tebalM,
          bevelEnabled: true,
          bevelSize: 0.002,
          bevelThickness: 0.002,
          bevelSegments: 1,
        });

        const cutMesh = new THREE.Mesh(cutGeo, cutMat);
        cutMesh.rotation.x = -Math.PI / 2;
        cutMesh.position.set(-centerX, tebalM, -centerZ);
        cutMesh.castShadow = true;
        cutMesh.receiveShadow = true;
        pavingGroup.add(cutMesh);
      }
    }

    // C. Kanstin Curb Perimeter (if enabled)
    if (showKanstin) {
      const kanstinMat = new THREE.MeshStandardMaterial({
        color: "#8a9199",
        roughness: 0.75,
      });

      const curbThickness = 0.12;
      const curbHeight = tebalM + 0.1;

      // North & South curbs
      const curbHGeo = new THREE.BoxGeometry(spanX + curbThickness * 2, curbHeight, curbThickness);
      const curbNorth = new THREE.Mesh(curbHGeo, kanstinMat);
      curbNorth.position.set(0, curbHeight / 2 - 0.02, -spanZ / 2 - curbThickness / 2);
      pavingGroup.add(curbNorth);

      const curbSouth = new THREE.Mesh(curbHGeo, kanstinMat);
      curbSouth.position.set(0, curbHeight / 2 - 0.02, spanZ / 2 + curbThickness / 2);
      pavingGroup.add(curbSouth);

      // East & West curbs
      const curbVGeo = new THREE.BoxGeometry(curbThickness, curbHeight, spanZ);
      const curbEast = new THREE.Mesh(curbVGeo, kanstinMat);
      curbEast.position.set(spanX / 2 + curbThickness / 2, curbHeight / 2 - 0.02, 0);
      pavingGroup.add(curbEast);

      const curbWest = new THREE.Mesh(curbVGeo, kanstinMat);
      curbWest.position.set(-spanX / 2 - curbThickness / 2, curbHeight / 2 - 0.02, 0);
      pavingGroup.add(curbWest);
    }

    // 9. Animation Render Loop
    let isDisposed = false;
    const animate = () => {
      if (isDisposed) return;
      animFrameIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 10. Resize handler
    const handleResize = () => {
      if (!containerRef.current || isDisposed) return;
      const w = containerRef.current.clientWidth || 600;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    };
    window.addEventListener("resize", handleResize);

    // 11. Cleanup
    return () => {
      isDisposed = true;
      window.removeEventListener("resize", handleResize);
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      controls.dispose();
      renderer.dispose();

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });
    };
  }, [layout, tebalCm, showKanstin, hasWebGL]);

  if (!hasWebGL) {
    return (
      <div className={css.panel}>
        <div className={css.errorAlert}>
          <strong>WebGL Tidak Aktif:</strong> Peramban atau perangkat Anda tidak mendukung akselerasi
          grafis 3D WebGL. Tampilan beralih ke Mode 2D Tampak Atas.
        </div>
      </div>
    );
  }

  return (
    <div className={css.panel}>
      <div className={css.panelHeader}>
        <h3 className={css.panelTitle}>Visualisasi 3D Interaktif</h3>
        <div className={css.toolbar}>
          <button
            type="button"
            className={`${css.toolBtn} ${activePreset === "iso" ? css.tabActive : ""}`}
            onClick={() => setActivePreset("iso")}
            title="Kamera Isometrik"
          >
            📐
          </button>
          <button
            type="button"
            className={`${css.toolBtn} ${activePreset === "jalan" ? css.tabActive : ""}`}
            onClick={() => setActivePreset("jalan")}
            title="Kamera Perspektif Jalan"
          >
            🚶
          </button>
          <button
            type="button"
            className={`${css.toolBtn} ${activePreset === "atas" ? css.tabActive : ""}`}
            onClick={() => setActivePreset("atas")}
            title="Kamera Tampak Atas"
          >
            ⬇️
          </button>
        </div>
      </div>

      {isSampleMode && (
        <div className={css.warningList}>
          <p className={css.warningText}>
            ⚡ <strong>Mode Sampel 3D Aktif:</strong> Lahan memiliki lebih dari 10.000 keping blok.
            Menampilkan zona representatif agar perangkat Anda tetap responsif. Estimasi material
            pada panel di bawah tetap dihitung akurat 100% untuk seluruh lahan.
          </p>
        </div>
      )}

      {/* 3D Canvas Container */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "440px",
          borderRadius: "16px",
          overflow: "hidden",
          position: "relative",
          touchAction: "none",
        }}
      />

      <div className={css.legendRow}>
        <div className={css.legendItem}>
          <span className={css.swatch} style={{ background: "#c8c6be" }} />
          <span>Blok Utuh ({layout.metrics.fullCount.toLocaleString("id-ID")})</span>
        </div>
        <div className={css.legendItem}>
          <span className={css.swatch} style={{ background: "#b0aba2" }} />
          <span>Potongan Tepi ({layout.metrics.partialCount.toLocaleString("id-ID")})</span>
        </div>
        {showKanstin && (
          <div className={css.legendItem}>
            <span className={css.swatch} style={{ background: "#8a9199" }} />
            <span>Kanstin Beton</span>
          </div>
        )}
      </div>
    </div>
  );
}
