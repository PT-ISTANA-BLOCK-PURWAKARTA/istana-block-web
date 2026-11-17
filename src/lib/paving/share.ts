/**
 * ShareState URL Serialization, Zod Validation, & WhatsApp Integration
 * Pure module: zero DOM, zero Three.js, completely verifiable in Vitest.
 */

import { z } from "zod";
import { waLink } from "../format";
import type { MaterialEstimate, PatternConfig } from "./engine/types";
import type { ProjectGeometry } from "./geometry/types";
import type { ProductId } from "./legacy/types";

export const SCHEMA_VERSION = 1;
export const ENGINE_VERSION = "1.0.0";

/**
 * Zod schema for validated ShareState.
 * Protects against maliciously crafted, oversized, or corrupted URL parameters.
 */
export const ShareStateSchema = z.object({
  v: z.literal(1),
  engineVersion: z.string(),
  geom: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("preset"),
      preset: z.enum(["rectangle", "l-shape", "u-shape", "trapezoid"]),
      params: z.record(z.string(), z.number().positive()),
    }),
    z.object({
      kind: z.literal("polygon"),
      // Quantized coordinates in centimeters [[x_cm, y_cm], ...]
      points: z.array(z.tuple([z.number(), z.number()])).min(3).max(500),
      source: z.enum(["grid", "map", "geojson", "kml"]).optional(),
    }),
  ]),
  cfg: z.object({
    productId: z.enum(["truepave", "hexagon", "fp21", "fp30", "grass"]),
    motifId: z.string().min(1).max(50),
    reservePercent: z.number().min(0).max(25),
    rotationDeg: z.number().optional(),
  }),
});

export type ShareState = z.infer<typeof ShareStateSchema>;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * Encode ShareState to a base64url string (100% universal: Browser, Node, Web Worker)
 */
export function encodeShareStateToBase64(state: ShareState): string {
  const jsonStr = JSON.stringify(state);
  const bytes = textEncoder.encode(jsonStr);
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decode and validate base64url string to ShareState via Zod (100% universal)
 */
export function decodeShareStateFromBase64(encoded: string): ShareState {
  if (!encoded || typeof encoded !== "string") {
    throw new Error("Kode konfigurasi berbagi kosong.");
  }

  let jsonStr = "";
  try {
    let b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    jsonStr = textDecoder.decode(bytes);
  } catch {
    throw new Error("Kode konfigurasi tidak dapat didekode (format base64 salah).");
  }

  let rawObj: unknown;
  try {
    rawObj = JSON.parse(jsonStr);
  } catch {
    throw new Error("Data konfigurasi tidak valid (bukan JSON yang benar).");
  }

  const parseResult = ShareStateSchema.safeParse(rawObj);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.issues.map((i) => i.message).join(", ");
    throw new Error(`Data konfigurasi gagal divalidasi: ${errorDetails}`);
  }

  return parseResult.data;
}

/**
 * Build full shareable URL
 */
export function buildShareUrl(baseUrl: string, state: ShareState): string {
  const code = encodeShareStateToBase64(state);
  const url = new URL(baseUrl);
  url.searchParams.set("pd_share", code);
  return url.toString();
}

export interface WhatsAppMessageOptions {
  whatsappNumber: string;
  shareUrl: string;
  productName: string;
  motifName: string;
  geometry: ProjectGeometry;
  estimate: MaterialEstimate;
  config: PatternConfig;
}

/**
 * Generate a comprehensive, professional WhatsApp message for Istana Block sales & customer
 */
export function createWhatsAppMessage(options: WhatsAppMessageOptions): string {
  const { shareUrl, productName, motifName, geometry, estimate, config } = options;

  const lines: string[] = [
    "Halo Admin PT Istana Block Purwakarta,",
    "Saya ingin berkonsultasi mengenai pemesanan paving block berdasarkan simulasi tata letak lahan berikut:",
    "",
    "📋 *DATA LAHAN & KEBUTUHAN MATERIAL:*",
    `• Sumber Bentuk: ${geometry.source.toUpperCase()}`,
    `• Luas Lahan: ${estimate.areaM2.toLocaleString("id-ID")} m²`,
    `• Keliling Tepi: ${geometry.metrics.perimeterM.toLocaleString("id-ID")} m`,
    `• Jenis Paving: ${productName}`,
    `• Pola Pemasangan: ${motifName} (${config.rotationDeg || 0}°)`,
    "",
    "🧱 *RINCIAN KEPING & CADANGAN:*",
    `• Blok Utuh: ${estimate.fullUnits.toLocaleString("id-ID")} keping`,
    `• Potongan Batas Tepi: ${estimate.cutInstalledPieces.toLocaleString("id-ID")} keping`,
    `• Kebutuhan Dasar: ${estimate.baseUnits.toLocaleString("id-ID")} keping`,
    `• Cadangan Potongan & Kerusakan (${estimate.reservePercent}%): +${estimate.reserveUnits.toLocaleString("id-ID")} keping`,
    `• *TOTAL REKOMENDASI PEMBELIAN: ${estimate.recommendedPurchaseUnits.toLocaleString("id-ID")} keping*`,
  ];

  if (estimate.extras?.stoneDustM3) {
    lines.push(`• Estimasi Abu Batu (5 cm): ±${estimate.extras.stoneDustM3.toFixed(1)} m³`);
  }
  if (estimate.extras?.kerbPcs) {
    lines.push(`• Estimasi Kanstin Pembatas: ±${estimate.extras.kerbPcs} batang`);
  }

  lines.push("");
  lines.push("🔗 *Tautan Tata Letak Interaktif (Desain Saya):*");
  lines.push(shareUrl);
  lines.push("");
  lines.push("Mohon info ketersediaan stok, ongkir armada ke lokasi proyek kami, dan jadwal pengiriman. Terima kasih!");

  return lines.join("\n");
}

/**
 * Generate full WhatsApp link (wa.me)
 */
export function createWhatsAppShareLink(options: WhatsAppMessageOptions): string {
  const message = createWhatsAppMessage(options);
  return waLink(options.whatsappNumber, message);
}
