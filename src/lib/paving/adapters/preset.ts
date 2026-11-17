/**
 * Preset Shape Geometry Generators
 * Converts side dimensions (in meters) into canonical ProjectGeometry.
 */

import { multiPolygonArea, multiPolygonBounds, multiPolygonPerimeter } from "../geometry/area";
import type { MultiPolygon2D, Point2D, ProjectGeometry, Ring2D } from "../geometry/types";
import { validateGeometry } from "../geometry/validate";

function buildProjectGeometry(
  mp: MultiPolygon2D,
  presetName: string,
): ProjectGeometry {
  const val = validateGeometry(mp);
  if (!val.valid) {
    throw new Error(`Preset ${presetName} tidak valid: ${val.errors.join("; ")}`);
  }

  const bounds = multiPolygonBounds(mp);
  const areaM2 = Math.round(multiPolygonArea(mp) * 1e6) / 1e6;
  const perimeterM = Math.round(multiPolygonPerimeter(mp) * 1e6) / 1e6;

  return {
    schemaVersion: "1.0.0",
    source: "preset",
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
}

/**
 * Persegi Panjang / Bujur Sangkar
 * @param lengthM Panjang sisi horizontal (meter)
 * @param widthM Lebar sisi vertikal (meter)
 */
export function createRectanglePreset(lengthM: number, widthM: number): ProjectGeometry {
  if (lengthM <= 0 || widthM <= 0) {
    throw new Error("Panjang dan lebar persegi harus lebih besar dari 0 meter.");
  }

  const ring: Ring2D = [
    [0, 0],
    [lengthM, 0],
    [lengthM, widthM],
    [0, widthM],
    [0, 0],
  ];

  return buildProjectGeometry([[ring]], "Persegi");
}

/**
 * Bentuk L (L-Shape)
 * @param totalWidthM Lebar total sisi bawah (meter)
 * @param totalHeightM Tinggi total sisi kiri (meter)
 * @param legWidthM Lebar kaki vertikal sisi kiri (meter)
 * @param legHeightM Tinggi kaki horizontal sisi bawah (meter)
 */
export function createLShapePreset(
  totalWidthM: number,
  totalHeightM: number,
  legWidthM: number,
  legHeightM: number,
): ProjectGeometry {
  if (totalWidthM <= 0 || totalHeightM <= 0 || legWidthM <= 0 || legHeightM <= 0) {
    throw new Error("Semua dimensi bentuk L harus lebih besar dari 0 meter.");
  }
  if (legWidthM >= totalWidthM) {
    throw new Error("Lebar kaki L (legWidth) harus lebih kecil dari total lebar (totalWidth).");
  }
  if (legHeightM >= totalHeightM) {
    throw new Error("Tinggi kaki L (legHeight) harus lebih kecil dari total tinggi (totalHeight).");
  }

  // CCW ring
  const ring: Ring2D = [
    [0, 0],
    [totalWidthM, 0],
    [totalWidthM, legHeightM],
    [legWidthM, legHeightM],
    [legWidthM, totalHeightM],
    [0, totalHeightM],
    [0, 0],
  ];

  return buildProjectGeometry([[ring]], "Bentuk L");
}

/**
 * Bentuk U (U-Shape)
 * @param totalWidthM Lebar total luar (meter)
 * @param totalHeightM Tinggi total luar (meter)
 * @param leftLegWidthM Lebar tiang sayap kiri (meter)
 * @param rightLegWidthM Lebar tiang sayap kanan (meter)
 * @param baseHeightM Tebal lantai bawah U (meter)
 */
export function createUShapePreset(
  totalWidthM: number,
  totalHeightM: number,
  leftLegWidthM: number,
  rightLegWidthM: number,
  baseHeightM: number,
): ProjectGeometry {
  if (totalWidthM <= 0 || totalHeightM <= 0 || leftLegWidthM <= 0 || rightLegWidthM <= 0 || baseHeightM <= 0) {
    throw new Error("Semua dimensi bentuk U harus lebih besar dari 0 meter.");
  }
  if (leftLegWidthM + rightLegWidthM >= totalWidthM) {
    throw new Error("Jumlah lebar kaki kiri dan kanan melebihi atau sama dengan total lebar.");
  }
  if (baseHeightM >= totalHeightM) {
    throw new Error("Tebal dasar lantai U harus lebih kecil dari total tinggi.");
  }

  const ring: Ring2D = [
    [0, 0],
    [totalWidthM, 0],
    [totalWidthM, totalHeightM],
    [totalWidthM - rightLegWidthM, totalHeightM],
    [totalWidthM - rightLegWidthM, baseHeightM],
    [leftLegWidthM, baseHeightM],
    [leftLegWidthM, totalHeightM],
    [0, totalHeightM],
    [0, 0],
  ];

  return buildProjectGeometry([[ring]], "Bentuk U");
}

/**
 * Trapesium
 * @param bottomWidthM Lebar sisi alas bawah (meter)
 * @param topWidthM Lebar sisi atas (meter)
 * @param heightM Tinggi tegak (meter)
 * @param offsetLeftM Pergeseran titik awal sisi atas dari sisi kiri (meter, default 0 untuk siku-siku)
 */
export function createTrapezoidPreset(
  bottomWidthM: number,
  topWidthM: number,
  heightM: number,
  offsetLeftM = 0,
): ProjectGeometry {
  if (bottomWidthM <= 0 || topWidthM <= 0 || heightM <= 0) {
    throw new Error("Dimensi trapesium harus lebih besar dari 0 meter.");
  }

  const ring: Ring2D = [
    [0, 0],
    [bottomWidthM, 0],
    [offsetLeftM + topWidthM, heightM],
    [offsetLeftM, heightM],
    [0, 0],
  ];

  return buildProjectGeometry([[ring]], "Trapesium");
}

/**
 * Tambahkan lubang (Hole) ke dalam poligon yang ada (misalnya taman di tengah plaza)
 */
export function addHoleToGeometry(
  geom: ProjectGeometry,
  holeRing: Ring2D,
  polyIndex = 0,
): ProjectGeometry {
  const mp: MultiPolygon2D = geom.geometry.map((poly, pIdx) => {
    if (pIdx !== polyIndex) return poly;
    return [poly[0], ...poly.slice(1), holeRing];
  });

  return buildProjectGeometry(mp, `${geom.source} + Lubang`);
}
