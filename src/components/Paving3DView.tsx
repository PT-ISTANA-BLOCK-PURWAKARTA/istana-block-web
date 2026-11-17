"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { HD_CM } from "@/lib/paving/catalog";
import type { ColorId, Placed, ProductId, Unit } from "./PatternCalculator";
import css from "./PatternCalculator.module.css";

export type Paving3DViewProps = {
  jenis: ProductId;
  shape: "rect" | "hex" | "grass";
  motif: { id: string; name: string; rot?: number };
  u: Unit;
  colors: ColorId[];
  shades: Record<ColorId, string[]>;
  tiles: Placed[];
  vw: number;
  vh: number;
  tebalCm: number;
  showKanstin: boolean;
  kanstinCm?: 40 | 60;
  onFallback2D?: () => void;
};

type PresetId = "iso" | "jalan" | "atas";

const PRESETS: { id: PresetId; label: string }[] = [
  { id: "iso", label: "Isometrik" },
  { id: "jalan", label: "Perspektif Jalan" },
  { id: "atas", label: "Tampak Atas" },
];

/** Harus cocok dengan konstanta geometri pada katalog bersama (satuan cm). */
const NAT = 0.6;
const HD = HD_CM;

const BEVEL_RECT = 0.35;
const BEVEL_HEX = 0.35;
const BEVEL_GRASS = 0.28;
const KANSTIN_WIDTH = 12;

type SceneMetrics = {
  slabW: number;
  slabD: number;
  tebalCm: number;
};

type CameraPose = {
  position: THREE.Vector3;
  target: THREE.Vector3;
};

type CameraTween = {
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  start: number;
  duration: number;
};

function isWebGLAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl")),
    );
  } catch {
    return false;
  }
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createConcreteTextures(maxAnisotropy: number) {
  const size = 256;
  const mapCanvas = document.createElement("canvas");
  const bumpCanvas = document.createElement("canvas");
  mapCanvas.width = bumpCanvas.width = size;
  mapCanvas.height = bumpCanvas.height = size;

  const mapCtx = mapCanvas.getContext("2d");
  const bumpCtx = bumpCanvas.getContext("2d");
  const rnd = mulberry32(20261112);

  if (mapCtx && bumpCtx) {
    const mapImg = mapCtx.createImageData(size, size);
    const bumpImg = bumpCtx.createImageData(size, size);
    const md = mapImg.data;
    const bd = bumpImg.data;

    for (let i = 0; i < size * size; i++) {
      const n1 = rnd();
      const n2 = rnd();
      const speckle = n2 > 0.96 ? -22 : n2 < 0.03 ? 12 : 0;
      const mv = Math.max(195, Math.min(255, Math.round(240 + (n1 - 0.5) * 20 + speckle)));
      const bv = Math.max(20, Math.min(245, Math.round(128 + (n1 - 0.5) * 90 + speckle * 2.2)));
      const p = i * 4;
      md[p] = md[p + 1] = md[p + 2] = mv;
      md[p + 3] = 255;
      bd[p] = bd[p + 1] = bd[p + 2] = bv;
      bd[p + 3] = 255;
    }

    mapCtx.putImageData(mapImg, 0, 0);
    bumpCtx.putImageData(bumpImg, 0, 0);
  }

  const map = new THREE.CanvasTexture(mapCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(0.045, 0.045);
  map.anisotropy = maxAnisotropy;

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(0.045, 0.045);
  bump.anisotropy = maxAnisotropy;

  return { map, bump };
}

function createSandTexture(maxAnisotropy: number) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const rnd = mulberry32(99173);

  if (ctx) {
    const img = ctx.createImageData(size, size);
    const d = img.data;
    for (let i = 0; i < size * size; i++) {
      const v = rnd();
      const grain = v > 0.9 ? -34 : v < 0.1 ? 26 : (v - 0.5) * 24;
      const p = i * 4;
      d[p] = Math.max(40, Math.min(200, Math.round(124 + grain)));
      d[p + 1] = Math.max(40, Math.min(200, Math.round(119 + grain)));
      d[p + 2] = Math.max(40, Math.min(200, Math.round(112 + grain)));
      d[p + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createTurfTexture(maxAnisotropy: number) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const rnd = mulberry32(55109);

  if (ctx) {
    const img = ctx.createImageData(size, size);
    const d = img.data;
    for (let i = 0; i < size * size; i++) {
      const v = rnd();
      const p = i * 4;
      if (v < 0.14) {
        // Sedikit tanah di sela rumput
        d[p] = 74;
        d[p + 1] = 62;
        d[p + 2] = 44;
      } else {
        const shade = (v - 0.5) * 34;
        d[p] = Math.max(45, Math.min(130, Math.round(86 + shade * 0.7)));
        d[p + 1] = Math.max(75, Math.min(175, Math.round(136 + shade)));
        d[p + 2] = Math.max(30, Math.min(95, Math.round(54 + shade * 0.5)));
      }
      d[p + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createDimensionBadge(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 280;
  canvas.height = 76;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // Pill background bergaya arsitektur / CAD
    ctx.fillStyle = "rgba(14, 42, 107, 0.94)";
    if (typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(8, 8, 264, 60, 30);
      ctx.fill();

      // Border outline
      ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(8, 8, 264, 60, 30);
      ctx.stroke();
    } else {
      ctx.fillRect(8, 8, 264, 60);
    }

    // Label dimensi teks
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 140, 38);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  return new THREE.Sprite(mat);
}

function createDimensionLine(
  start: THREE.Vector3,
  end: THREE.Vector3,
  tickDir: THREE.Vector3,
  tickLen: number,
  label: string,
  badgeScale = { w: 18, h: 4.9 },
): THREE.Group {
  const group = new THREE.Group();

  // Posisi garis dimensi utama + 2 garis tick di kedua ujung
  const pos: number[] = [
    start.x, start.y, start.z,
    end.x, end.y, end.z,
    // start tick
    start.x - tickDir.x * tickLen * 0.5, start.y - tickDir.y * tickLen * 0.5, start.z - tickDir.z * tickLen * 0.5,
    start.x + tickDir.x * tickLen * 0.5, start.y + tickDir.y * tickLen * 0.5, start.z + tickDir.z * tickLen * 0.5,
    // end tick
    end.x - tickDir.x * tickLen * 0.5, end.y - tickDir.y * tickLen * 0.5, end.z - tickDir.z * tickLen * 0.5,
    end.x + tickDir.x * tickLen * 0.5, end.y + tickDir.y * tickLen * 0.5, end.z + tickDir.z * tickLen * 0.5,
  ];

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({
    color: 0x0e2a6b,
    transparent: true,
    opacity: 0.85,
  });
  const lines = new THREE.LineSegments(geo, mat);
  group.add(lines);

  // Badge mengambang di tengah garis
  const sprite = createDimensionBadge(label);
  sprite.scale.set(badgeScale.w, badgeScale.h, 1);
  sprite.position.set(
    (start.x + end.x) * 0.5,
    (start.y + end.y) * 0.5 + 3.0,
    (start.z + end.z) * 0.5,
  );
  group.add(sprite);

  return group;
}

function addRoundedRectContour(shape: THREE.Shape, bw: number, bh: number, cornerRadius: number) {
  const hw = bw / 2;
  const hh = bh / 2;
  const r = Math.min(cornerRadius, hw * 0.25, hh * 0.25);
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
}

function createTileGeometry(shapeKind: "rect" | "hex" | "grass", w: number, h: number, tebalCm: number): THREE.ExtrudeGeometry {
  if (shapeKind === "hex") {
    const bevel = BEVEL_HEX;
    const depth = Math.max(1, tebalCm - 2 * bevel);
    const radius = (HD - NAT) / Math.sqrt(3);
    const s = new THREE.Shape();
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k - Math.PI / 2;
      const px = radius * Math.cos(a);
      const py = radius * Math.sin(a);
      if (k === 0) s.moveTo(px, py);
      else s.lineTo(px, py);
    }
    s.closePath();

    const geo = new THREE.ExtrudeGeometry(s, {
      depth,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelOffset: -bevel,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, bevel, 0);
    return geo;
  }

  if (shapeKind === "grass") {
    const bevel = BEVEL_GRASS;
    const depth = Math.max(1, tebalCm - 2 * bevel);
    const bw = Math.max(4, w - NAT);
    const bh = Math.max(4, h - NAT);
    const hw = bw / 2;
    const hh = bh / 2;

    const s = new THREE.Shape();
    addRoundedRectContour(s, bw, bh, 0.45);

    const holeW = bw * 0.2;
    const holeH = bh * 0.3;
    const gx = (bw - 3 * holeW) / 4;
    const gy = (bh - 2 * holeH) / 3;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const x0 = -hw + gx + col * (holeW + gx);
        const y0 = -hh + gy + row * (holeH + gy);
        const x1 = x0 + holeW;
        const y1 = y0 + holeH;
        // Arah jarum jam (berlawanan dengan kontur luar CCW) agar lubang & bevel konsisten
        const hole = new THREE.Path();
        hole.moveTo(x0, y0);
        hole.lineTo(x0, y1);
        hole.lineTo(x1, y1);
        hole.lineTo(x1, y0);
        hole.closePath();
        s.holes.push(hole);
      }
    }

    const geo = new THREE.ExtrudeGeometry(s, {
      depth,
      bevelEnabled: true,
      bevelSegments: 1,
      curveSegments: 2,
      steps: 1,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelOffset: -bevel,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, bevel, 0);
    return geo;
  }

  // Persegi panjang / bujur sangkar (truepave, fp21, fp30)
  const bevel = BEVEL_RECT;
  const depth = Math.max(1, tebalCm - 2 * bevel);
  const bw = Math.max(2, Math.max(w, h) - NAT);
  const bh = Math.max(2, Math.min(w, h) - NAT);
  const s = new THREE.Shape();
  addRoundedRectContour(s, bw, bh, 0.55);

  const geo = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelSegments: 1,
    curveSegments: 2,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelOffset: -bevel,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bevel, 0);
  return geo;
}

function createKanstinGeometry(segLen: number, tebalCm: number): THREE.ExtrudeGeometry {
  const hw = KANSTIN_WIDTH / 2;
  const bottomY = -2;
  const topY = tebalCm + 6;
  const noseY = tebalCm + 1.2;
  const bevel = 0.25;
  const depth = Math.max(2, segLen - 0.5 - 2 * bevel);

  const s = new THREE.Shape();
  s.moveTo(-hw, bottomY);
  s.lineTo(hw, bottomY);
  s.lineTo(hw, topY);
  s.lineTo(1.8, topY);
  s.lineTo(-hw, noseY);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelOffset: -bevel,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

function computePresetPose(preset: PresetId, metrics: SceneMetrics, fovDeg: number, aspect: number): CameraPose {
  const { slabW, slabD, tebalCm } = metrics;
  const safeAspect = Math.max(0.6, aspect);
  const vFov = (fovDeg * Math.PI) / 180;
  const tanV = Math.tan(vFov / 2);
  const tanH = tanV * safeAspect;

  if (preset === "atas") {
    const dist = Math.max((slabD * 0.58) / tanV, (slabW * 0.58) / tanH);
    const dir = new THREE.Vector3(0, 1, 0.002).normalize();
    const target = new THREE.Vector3(0, tebalCm * 0.3, 0);
    return { position: target.clone().addScaledVector(dir, dist), target };
  }

  if (preset === "jalan") {
    const spanH = slabW * 0.92 + slabD * 0.35;
    const spanV = slabD * 0.38 + tebalCm * 2.2;
    const dist = Math.max((spanV * 0.56) / tanV, (spanH * 0.56) / tanH) * 0.72;
    const dir = new THREE.Vector3(0.28, 0.32, 0.91).normalize();
    const target = new THREE.Vector3(0, tebalCm * 0.55, -slabD * 0.06);
    return { position: target.clone().addScaledVector(dir, dist), target };
  }

  // Default: Isometrik 3/4
  const spanH = 0.78 * slabW + 0.62 * slabD;
  const spanV = 0.62 * (0.62 * slabW + 0.78 * slabD) + tebalCm;
  const dist = Math.max((spanV * 0.58) / tanV, (spanH * 0.58) / tanH);
  const dir = new THREE.Vector3(0.7, 0.74, 0.86).normalize();
  const target = new THREE.Vector3(0, tebalCm * 0.35, 0);
  return { position: target.clone().addScaledVector(dir, dist), target };
}

function disposeGroupResources(group: THREE.Group) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        for (const m of mesh.material) {
          materials.add(m);
          if ("map" in m && m.map instanceof THREE.Texture) textures.add(m.map);
        }
      } else {
        materials.add(mesh.material);
        if ("map" in mesh.material && mesh.material.map instanceof THREE.Texture) {
          textures.add(mesh.material.map);
        }
      }
    }
  });

  group.clear();
  for (const g of geometries) g.dispose();
  for (const m of materials) m.dispose();
  for (const t of textures) t.dispose();
}

export function Paving3DView({
  jenis,
  shape,
  motif,
  u,
  colors,
  shades,
  tiles,
  vw,
  vh,
  tebalCm,
  showKanstin,
  kanstinCm = 40,
  onFallback2D,
}: Paving3DViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetId | null>("iso");

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = wrapRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if ((el as any).webkitRequestFullscreen) {
          await (el as any).webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
      }
    } catch {
      // Fallback
    }
  }, []);

  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    patternGroup: THREE.Group;
    sunLight: THREE.DirectionalLight;
    concreteMap: THREE.CanvasTexture;
    concreteBump: THREE.CanvasTexture;
    sandMap: THREE.CanvasTexture;
    turfMap: THREE.CanvasTexture;
    metrics: SceneMetrics;
    aspect: number;
    reducedMotion: boolean;
    tween: CameraTween | null;
    requestRender: () => void;
  } | null>(null);

  const activePresetRef = useRef<PresetId | null>("iso");
  useEffect(() => {
    activePresetRef.current = activePreset;
  }, [activePreset]);

  const applyPreset = useCallback((preset: PresetId, animate: boolean) => {
    const ctx = sceneRef.current;
    if (!ctx) return;
    setActivePreset(preset);
    activePresetRef.current = preset;

    const pose = computePresetPose(preset, ctx.metrics, ctx.camera.fov, ctx.aspect);
    if (!animate || ctx.reducedMotion) {
      ctx.tween = null;
      ctx.camera.position.copy(pose.position);
      ctx.controls.target.copy(pose.target);
      ctx.controls.update();
      ctx.requestRender();
      return;
    }

    ctx.tween = {
      fromPos: ctx.camera.position.clone(),
      toPos: pose.position,
      fromTarget: ctx.controls.target.clone(),
      toTarget: pose.target,
      start: performance.now(),
      duration: 420,
    };
    ctx.requestRender();
  }, []);

  // Inisialisasi WebGLRenderer, Scene, Camera, OrbitControls & ResizeObserver (sekali per mount)
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!isWebGLAvailable()) {
      setWebglUnavailable(true);
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: true,
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reducedMotion = motionQuery.matches;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "none";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `Pratinjau 3D interaktif pola ${motif.name}`);
    host.appendChild(canvas);

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });

    let rafId = 0;
    let disposed = false;

    const onContextLost = (e: Event) => {
      e.preventDefault();
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      setWebglUnavailable(true);
    };
    canvas.addEventListener("webglcontextlost", onContextLost);

    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const aspect = width / height;
    renderer.setSize(width, height, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, aspect, 2, 3000);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = !reducedMotion;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minPolarAngle = 0.02;
    controls.enablePan = true;
    controls.screenSpacePanning = false;
    controls.rotateSpeed = 0.85;
    controls.zoomSpeed = 1.0;
    controls.enableZoom = true;
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    // Pencahayaan siang hari yang lembut agar chamfer & tekstur beton tampak jelas
    const hemi = new THREE.HemisphereLight(0xf6f9ff, 0x8f8578, 1.0);
    scene.add(hemi);

    const sunLight = new THREE.DirectionalLight(0xfffaf0, 1.9);
    sunLight.position.set(170, 260, 150);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.near = 40;
    sunLight.shadow.camera.far = 900;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.25;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0xd9e6ff, 0.55);
    rimLight.position.set(-160, 120, -140);
    scene.add(rimLight);

    const patternGroup = new THREE.Group();
    scene.add(patternGroup);

    const maxAnisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const { map: concreteMap, bump: concreteBump } = createConcreteTextures(maxAnisotropy);
    const sandMap = createSandTexture(maxAnisotropy);
    const turfMap = createTurfTexture(maxAnisotropy);

    const tick = (now: number) => {
      rafId = 0;
      if (disposed) return;
      const ctx = sceneRef.current;
      if (!ctx) return;

      let tweenActive = false;
      if (ctx.tween) {
        const elapsed = now - ctx.tween.start;
        const t = Math.min(1, elapsed / ctx.tween.duration);
        const ease = 1 - Math.pow(1 - t, 3);
        camera.position.lerpVectors(ctx.tween.fromPos, ctx.tween.toPos, ease);
        controls.target.lerpVectors(ctx.tween.fromTarget, ctx.tween.toTarget, ease);
        if (t >= 1) {
          ctx.tween = null;
        } else {
          tweenActive = true;
        }
      }

      const dampingMoved = controls.update();
      renderer.render(scene, camera);

      if (tweenActive || dampingMoved) {
        requestRender();
      }
    };

    const requestRender = () => {
      if (disposed || rafId !== 0) return;
      rafId = window.requestAnimationFrame(tick);
    };

    const onControlStart = () => {
      if (sceneRef.current) sceneRef.current.tween = null;
      if (activePresetRef.current !== null) {
        activePresetRef.current = null;
        setActivePreset(null);
      }
    };

    const onMotionChange = (e: MediaQueryListEvent) => {
      if (!sceneRef.current) return;
      sceneRef.current.reducedMotion = e.matches;
      controls.enableDamping = !e.matches;
    };

    controls.addEventListener("change", requestRender);
    controls.addEventListener("start", onControlStart);
    motionQuery.addEventListener("change", onMotionChange);

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !sceneRef.current) return;
      const w = Math.max(1, Math.round(entry.contentRect.width));
      const h = Math.max(1, Math.round(entry.contentRect.height));
      const nextAspect = w / h;
      sceneRef.current.aspect = nextAspect;
      camera.aspect = nextAspect;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setSize(w, h, false);
      if (activePresetRef.current) {
        const pose = computePresetPose(activePresetRef.current, sceneRef.current.metrics, camera.fov, nextAspect);
        camera.position.copy(pose.position);
        controls.target.copy(pose.target);
        controls.update();
      }
      requestRender();
    });
    ro.observe(host);

    sceneRef.current = {
      renderer,
      scene,
      camera,
      controls,
      patternGroup,
      sunLight,
      concreteMap,
      concreteBump,
      sandMap,
      turfMap,
      metrics: { slabW: vw + 9, slabD: vh + 9, tebalCm },
      aspect,
      reducedMotion,
      tween: null,
      requestRender,
    };

    return () => {
      disposed = true;
      if (rafId !== 0) window.cancelAnimationFrame(rafId);
      ro.disconnect();
      motionQuery.removeEventListener("change", onMotionChange);
      controls.removeEventListener("change", requestRender);
      controls.removeEventListener("start", onControlStart);
      controls.dispose();
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      disposeGroupResources(patternGroup);
      concreteMap.dispose();
      concreteBump.dispose();
      sandMap.dispose();
      turfMap.dispose();
      renderer.dispose();
      canvas.remove();
      sceneRef.current = null;
    };
    // Sengaja hanya dijalankan saat mount/unmount agar WebGL context & tekstur tetap dipakai ulang saat motif berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bangun ulang geometri blok, alas abu-batu, rumput, dan kanstin saat pola atau pelengkap berubah
  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;

    const { patternGroup, concreteMap, concreteBump, sandMap, turfMap, sunLight, camera, controls } = ctx;
    const prevSpan = Math.max(ctx.metrics.slabW, ctx.metrics.slabD);

    disposeGroupResources(patternGroup);

    const canvas = ctx.renderer.domElement;
    canvas.setAttribute("aria-label", `Pratinjau 3D interaktif pola ${motif.name}, tebal ${tebalCm} cm`);

    const rot = motif.rot ?? 0;
    const rad = (rot * Math.PI) / 180;
    const cs = Math.cos(rad);
    const sn = Math.sin(rad);
    const ux = u.w / 2;
    const uy = u.h / 2;
    const hexR = (HD - NAT) / Math.sqrt(3);

    type Placed3D = {
      tile: Placed;
      wx: number;
      wz: number;
      rotY: number;
    };

    const placedList: Placed3D[] = [];
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const t of tiles) {
      const cxLocal = (shape === "hex" ? t.x : t.x + t.w / 2) - ux;
      const cyLocal = (shape === "hex" ? t.y : t.y + t.h / 2) - uy;
      const wx = cxLocal * cs - cyLocal * sn;
      const wz = cxLocal * sn + cyLocal * cs;
      const rot90 = shape === "rect" && t.h > t.w ? Math.PI / 2 : 0;
      const rotY = -rad + rot90;

      placedList.push({ tile: t, wx, wz, rotY });

      if (shape === "hex") {
        minX = Math.min(minX, wx - hexR);
        maxX = Math.max(maxX, wx + hexR);
        minZ = Math.min(minZ, wz - hexR);
        maxZ = Math.max(maxZ, wz + hexR);
      } else {
        const hw = Math.max(1, t.w - NAT) / 2;
        const hh = Math.max(1, t.h - NAT) / 2;
        const extX = Math.abs(hw * cs) + Math.abs(hh * sn);
        const extZ = Math.abs(hw * sn) + Math.abs(hh * cs);
        minX = Math.min(minX, wx - extX);
        maxX = Math.max(maxX, wx + extX);
        minZ = Math.min(minZ, wz - extZ);
        maxZ = Math.max(maxZ, wz + extZ);
      }
    }

    if (!Number.isFinite(minX)) {
      minX = -vw / 2;
      maxX = vw / 2;
      minZ = -vh / 2;
      maxZ = vh / 2;
    }

    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const padW = maxX - minX;
    const padD = maxZ - minZ;

    // Kelompokkan berdasarkan bentuk unik untuk InstancedMesh (umumnya 1 draw call untuk seluruh blok!)
    const groups = new Map<string, { w: number; h: number; items: Placed3D[] }>();
    for (const item of placedList) {
      const { tile } = item;
      const key =
        shape === "hex"
          ? "hex"
          : shape === "grass"
            ? `grass:${Math.round(tile.w * 100)}x${Math.round(tile.h * 100)}`
            : `rect:${Math.round(Math.max(tile.w, tile.h) * 100)}x${Math.round(Math.min(tile.w, tile.h) * 100)}`;
      const entry = groups.get(key);
      if (entry) entry.items.push(item);
      else groups.set(key, { w: tile.w, h: tile.h, items: [item] });
    }

    const dummy = new THREE.Object3D();
    const tmpColor = new THREE.Color();

    for (const { w, h, items } of groups.values()) {
      if (items.length === 0) continue;
      const geo = createTileGeometry(shape, w, h, tebalCm);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: concreteMap,
        bumpMap: concreteBump,
        bumpScale: 0.14,
        roughness: 0.86,
        metalness: 0.02,
      });

      const inst = new THREE.InstancedMesh(geo, mat, items.length);
      inst.castShadow = true;
      inst.receiveShadow = true;
      inst.frustumCulled = false;

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        dummy.position.set(it.wx - centerX, 0, it.wz - centerZ);
        dummy.rotation.set(0, it.rotY, 0);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);

        const cId = colors[it.tile.r] ?? colors[0] ?? "N";
        const palette = shades[cId] ?? shades.N;
        const hex = palette[it.tile.t % palette.length] ?? palette[0] ?? "#B5B4AF";
        tmpColor.set(hex);
        inst.setColorAt(i, tmpColor);
      }

      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      inst.computeBoundingSphere();
      patternGroup.add(inst);
    }

    // Lapisan rumput & tanah di dalam lubang Grass Block
    if (shape === "grass" && placedList.length > 0) {
      const sample = placedList[0].tile;
      const turfW = Math.max(4, sample.w - NAT - 3.0);
      const turfD = Math.max(4, sample.h - NAT - 3.0);
      const turfH = Math.max(0.8, tebalCm - 1.3);
      const turfGeo = new THREE.BoxGeometry(turfW, turfH, turfD);
      const turfMat = new THREE.MeshStandardMaterial({
        map: turfMap,
        roughness: 0.94,
        metalness: 0.0,
      });

      const turfInst = new THREE.InstancedMesh(turfGeo, turfMat, placedList.length);
      turfInst.receiveShadow = true;
      turfInst.frustumCulled = false;

      const turfY = 0.15 + turfH / 2;
      for (let i = 0; i < placedList.length; i++) {
        const it = placedList[i];
        dummy.position.set(it.wx - centerX, turfY, it.wz - centerZ);
        dummy.rotation.set(0, it.rotY, 0);
        dummy.updateMatrix();
        turfInst.setMatrixAt(i, dummy.matrix);
      }
      turfInst.instanceMatrix.needsUpdate = true;
      turfInst.computeBoundingSphere();
      patternGroup.add(turfInst);
    }

    // Alas abu batu (5 cm) & sub-base pondasi
    const margin = showKanstin ? NAT + KANSTIN_WIDTH + 2.5 : 4.5;
    const slabW = padW + 2 * margin;
    const slabD = padD + 2 * margin;

    sandMap.repeat.set(Math.max(1, slabW / 32), Math.max(1, slabD / 32));
    const sandGeo = new THREE.BoxGeometry(slabW, 5.0, slabD);
    const sandMat = new THREE.MeshStandardMaterial({
      map: sandMap,
      color: 0xdad6ce,
      roughness: 0.96,
      metalness: 0.0,
    });
    const sandMesh = new THREE.Mesh(sandGeo, sandMat);
    sandMesh.position.set(0, -2.35, 0);
    sandMesh.receiveShadow = true;
    patternGroup.add(sandMesh);

    const baseGeo = new THREE.BoxGeometry(slabW + 1.6, 2.4, slabD + 1.6);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x574e44,
      roughness: 0.98,
      metalness: 0.0,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.set(0, -6.05, 0);
    baseMesh.receiveShadow = true;
    patternGroup.add(baseMesh);

    // Kanstin pembatas tepi (opsional mengikuti pilihan st.k)
    if (showKanstin) {
      const innerHalfX = padW / 2 + NAT;
      const innerHalfZ = padD / 2 + NAT;
      const curbCenterX = innerHalfX + KANSTIN_WIDTH / 2;
      const curbCenterZ = innerHalfZ + KANSTIN_WIDTH / 2;

      const totalX = padW + 2 * NAT + 2 * KANSTIN_WIDTH;
      const nX = Math.max(1, Math.round(totalX / kanstinCm));
      const segX = totalX / nX;

      const totalZ = padD + 2 * NAT;
      const nZ = Math.max(1, Math.round(totalZ / kanstinCm));
      const segZ = totalZ / nZ;

      const kanstinMat = new THREE.MeshStandardMaterial({
        color: 0xb9b7b1,
        map: concreteMap,
        bumpMap: concreteBump,
        bumpScale: 0.14,
        roughness: 0.86,
        metalness: 0.02,
      });

      const tbGeo = createKanstinGeometry(segX, tebalCm);
      const tbInst = new THREE.InstancedMesh(tbGeo, kanstinMat, nX * 2);
      tbInst.castShadow = true;
      tbInst.receiveShadow = true;
      tbInst.frustumCulled = false;

      let tbIdx = 0;
      for (let i = 0; i < nX; i++) {
        const x = -totalX / 2 + (i + 0.5) * segX;
        // Sisi belakang (-Z): hidung miring menghadap +Z
        dummy.position.set(x, 0, -curbCenterZ);
        dummy.rotation.set(0, Math.PI / 2, 0);
        dummy.updateMatrix();
        tbInst.setMatrixAt(tbIdx++, dummy.matrix);

        // Sisi depan (+Z): hidung miring menghadap -Z
        dummy.position.set(x, 0, curbCenterZ);
        dummy.rotation.set(0, -Math.PI / 2, 0);
        dummy.updateMatrix();
        tbInst.setMatrixAt(tbIdx++, dummy.matrix);
      }
      tbInst.instanceMatrix.needsUpdate = true;
      tbInst.computeBoundingSphere();
      patternGroup.add(tbInst);

      const lrGeo = createKanstinGeometry(segZ, tebalCm);
      const lrInst = new THREE.InstancedMesh(lrGeo, kanstinMat, nZ * 2);
      lrInst.castShadow = true;
      lrInst.receiveShadow = true;
      lrInst.frustumCulled = false;

      let lrIdx = 0;
      for (let i = 0; i < nZ; i++) {
        const z = -totalZ / 2 + (i + 0.5) * segZ;
        // Sisi kanan (+X): hidung miring menghadap -X
        dummy.position.set(curbCenterX, 0, z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        lrInst.setMatrixAt(lrIdx++, dummy.matrix);

        // Sisi kiri (-X): hidung miring menghadap +X
        dummy.position.set(-curbCenterX, 0, z);
        dummy.rotation.set(0, Math.PI, 0);
        dummy.updateMatrix();
        lrInst.setMatrixAt(lrIdx++, dummy.matrix);
      }
      lrInst.instanceMatrix.needsUpdate = true;
      lrInst.computeBoundingSphere();
      patternGroup.add(lrInst);
    }

    // Garis Dimensi Arsitektur 3D (CAD Style): Lebar, Panjang, dan Tebal
    const frontEdgeZ = showKanstin ? padD / 2 + NAT + KANSTIN_WIDTH : padD / 2;
    const rightEdgeX = showKanstin ? padW / 2 + NAT + KANSTIN_WIDTH : padW / 2;
    const dimY = 0.5;
    const offsetDist = 6.0;

    // 1. Garis Dimensi Lebar (sepanjang sumbu X di tepi depan)
    const wStart = new THREE.Vector3(-padW / 2, dimY, frontEdgeZ + offsetDist);
    const wEnd = new THREE.Vector3(padW / 2, dimY, frontEdgeZ + offsetDist);
    const wLabel = `Lebar ${(padW / 100).toFixed(1).replace(".", ",")} m`;
    const wLineGroup = createDimensionLine(wStart, wEnd, new THREE.Vector3(0, 0, 1), 4.0, wLabel, { w: 18, h: 4.9 });
    patternGroup.add(wLineGroup);

    // 2. Garis Dimensi Panjang (sepanjang sumbu Z di tepi kanan)
    const dStart = new THREE.Vector3(rightEdgeX + offsetDist, dimY, -padD / 2);
    const dEnd = new THREE.Vector3(rightEdgeX + offsetDist, dimY, padD / 2);
    const dLabel = `Panjang ${(padD / 100).toFixed(1).replace(".", ",")} m`;
    const dLineGroup = createDimensionLine(dStart, dEnd, new THREE.Vector3(1, 0, 0), 4.0, dLabel, { w: 20, h: 4.9 });
    patternGroup.add(dLineGroup);

    // 3. Garis Dimensi Tebal (sepanjang sumbu Y di sudut depan kanan)
    const tStart = new THREE.Vector3(rightEdgeX + offsetDist, 0, frontEdgeZ + offsetDist);
    const tEnd = new THREE.Vector3(rightEdgeX + offsetDist, tebalCm, frontEdgeZ + offsetDist);
    const tLabel = `Tebal ${tebalCm} cm`;
    const tLineGroup = createDimensionLine(tStart, tEnd, new THREE.Vector3(1, 0, 1).normalize(), 3.0, tLabel, { w: 15, h: 4.5 });
    patternGroup.add(tLineGroup);

    // Sesuaikan area bayangan & batas jarak kamera dengan ukuran potongan
    const nextMetrics: SceneMetrics = { slabW, slabD, tebalCm };
    ctx.metrics = nextMetrics;

    const halfShadow = Math.max(slabW, slabD) * 0.65;
    sunLight.shadow.camera.left = -halfShadow;
    sunLight.shadow.camera.right = halfShadow;
    sunLight.shadow.camera.top = halfShadow;
    sunLight.shadow.camera.bottom = -halfShadow;
    sunLight.shadow.camera.updateProjectionMatrix();

    const span = Math.max(slabW, slabD);
    controls.minDistance = span * 0.34;
    controls.maxDistance = span * 2.6;

    if (activePresetRef.current) {
      const pose = computePresetPose(activePresetRef.current, nextMetrics, camera.fov, ctx.aspect);
      camera.position.copy(pose.position);
      controls.target.copy(pose.target);
    } else if (prevSpan > 0 && Math.abs(span - prevSpan) > 10) {
      const ratio = span / prevSpan;
      camera.position.sub(controls.target).multiplyScalar(ratio).add(controls.target);
    }

    controls.update();
    ctx.requestRender();
  }, [jenis, shape, motif, u, colors, shades, tiles, vw, vh, tebalCm, showKanstin, kanstinCm]);

  if (webglUnavailable) {
    return (
      <div className={css.fallback3d} role="region" aria-label="Pratinjau 3D tidak tersedia">
        <div className={css.fallbackBox}>
          <b>Pratinjau 3D tidak tersedia di peramban ini</b>
          <p>Peramban atau perangkat Anda belum mendukung WebGL. Gunakan pratinjau 2D untuk melihat skala asli dan komposisi warna.</p>
          {onFallback2D && (
            <button type="button" className="btn btn-sm btn-blue" onClick={onFallback2D}>
              Kembali ke 2D Tampak Atas
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className={`${css.wrap3d} ${isFullscreen ? css.wrap3dFullscreen : ""}`}>
      <div ref={hostRef} className={css.canvasHost} />
      <div className={css.presets3d} role="group" aria-label="Sudut kamera 3D" data-pp-noprint>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`${css.presetBtn} ${activePreset === p.id ? css.presetBtnActive : ""}`}
            aria-pressed={activePreset === p.id}
            onClick={() => applyPreset(p.id, true)}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          className={`${css.fullscreenBtn} ${isFullscreen ? css.fullscreenBtnActive : ""}`}
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Keluar layar penuh" : "Pratinjau layar penuh"}
          title={isFullscreen ? "Keluar layar penuh" : "Layar penuh"}
        >
          {isFullscreen ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          )}
          <span>{isFullscreen ? "Kecilkan" : "Layar Penuh"}</span>
        </button>
      </div>

      <div
        className={css.scaleHud}
        aria-label={`Dimensi area simulasi: ${(vw / 100).toFixed(1)} m × ${(vh / 100).toFixed(1)} m, tebal ${tebalCm} cm`}
        data-pp-noprint
      >
        <div className={css.metricCardHeader}>
          <span className={css.metricBadge}>Area Simulasi</span>
          <span className={css.metricTebalBadge}>Tebal {tebalCm} cm</span>
        </div>
        <div className={css.metricValueRow}>
          <span className={css.metricDimensions}>
            {(vw / 100).toFixed(1).replace(".", ",")} × {(vh / 100).toFixed(1).replace(".", ",")}
            <small className={css.metricUnit}> m</small>
          </span>
          <span className={css.metricAreaChip}>
            {((vw * vh) / 10000).toFixed(1).replace(".", ",")} m²
          </span>
        </div>
      </div>

      <span className={css.hint3d} aria-hidden="true" data-pp-noprint>
        Seret untuk putar · Cubit/Scroll untuk zoom
      </span>
    </div>
  );
}

export default Paving3DView;
