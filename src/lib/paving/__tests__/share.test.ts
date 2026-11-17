/**
 * Share & WhatsApp Serialization Test Suite
 * Verifies round-trip determinism, Zod schema constraints, and WhatsApp message fidelity.
 */

import { describe, expect, it } from "vitest";
import {
  buildShareUrl,
  createWhatsAppMessage,
  createWhatsAppShareLink,
  decodeShareStateFromBase64,
  encodeShareStateToBase64,
  type ShareState,
} from "../share";
import { createRectanglePreset } from "../adapters/preset";
import { calculateMaterialEstimate } from "../engine/estimate";
import { generateLayout } from "../engine/layout";
import type { PatternConfig } from "../engine/types";

describe("F6 Share & WhatsApp Suite", () => {
  describe("Zod & Round-trip Serialization", () => {
    it("round-trips preset ShareState deterministically", () => {
      const state: ShareState = {
        v: 1,
        engineVersion: "1.0.0",
        geom: {
          kind: "preset",
          preset: "l-shape",
          params: { l1: 15, w1: 10, l2: 8, w2: 6 },
        },
        cfg: {
          productId: "truepave",
          motifId: "herringbone90",
          reservePercent: 5,
          rotationDeg: 45,
        },
      };

      const encoded = encodeShareStateToBase64(state);
      expect(typeof encoded).toBe("string");
      expect(encoded.length).toBeGreaterThan(20);

      const decoded = decodeShareStateFromBase64(encoded);
      expect(decoded).toEqual(state);
    });

    it("round-trips polygon ShareState with quantized points deterministically", () => {
      const state: ShareState = {
        v: 1,
        engineVersion: "1.0.0",
        geom: {
          kind: "polygon",
          points: [
            [0, 0],
            [1000, 0],
            [1000, 500],
            [0, 500],
            [0, 0],
          ],
          source: "grid",
        },
        cfg: {
          productId: "hexagon",
          motifId: "hex-standard",
          reservePercent: 10,
          rotationDeg: 0,
        },
      };

      const encoded = encodeShareStateToBase64(state);
      const decoded = decodeShareStateFromBase64(encoded);
      expect(decoded).toEqual(state);
    });

    it("performs 50 random round-trip tests reliably", () => {
      const products = ["truepave", "hexagon", "fp21", "fp30", "grass"] as const;
      const motifs = ["bata", "anyaman", "herringbone", "susun"];
      const presets = ["rectangle", "l-shape", "u-shape", "trapezoid"] as const;

      for (let i = 0; i < 50; i++) {
        const prod = products[i % products.length];
        const motif = motifs[i % motifs.length];
        const preset = presets[i % presets.length];
        const res = (i % 4) * 5; // 0, 5, 10, 15

        const testState: ShareState = {
          v: 1,
          engineVersion: "1.0.0",
          geom: {
            kind: "preset",
            preset,
            params: { lengthM: 10 + (i % 20), widthM: 5 + (i % 15) },
          },
          cfg: {
            productId: prod,
            motifId: motif,
            reservePercent: res,
            rotationDeg: i % 2 === 0 ? 0 : 45,
          },
        };

        const encoded = encodeShareStateToBase64(testState);
        const decoded = decodeShareStateFromBase64(encoded);
        expect(decoded).toEqual(testState);
      }
    });

    it("rejects corrupted base64 input safely", () => {
      expect(() => decodeShareStateFromBase64("NOT_A_VALID_BASE64_STRING_!!!")).toThrowError(
        /gagal divalidasi|tidak dapat didekode|bukan JSON/i,
      );
    });

    it("rejects invalid schema version or missing fields", () => {
      const invalidJson = JSON.stringify({ v: 2, geom: { kind: "invalid" } });
      const invalid = btoa(invalidJson).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

      expect(() => decodeShareStateFromBase64(invalid)).toThrowError(
        /Data konfigurasi gagal divalidasi/i,
      );
    });

    it("builds full valid URL with query parameter", () => {
      const state: ShareState = {
        v: 1,
        engineVersion: "1.0.0",
        geom: {
          kind: "preset",
          preset: "rectangle",
          params: { lengthM: 12, widthM: 6 },
        },
        cfg: {
          productId: "truepave",
          motifId: "bata",
          reservePercent: 5,
        },
      };

      const url = buildShareUrl("https://istanablock.com/pola-paving", state);
      expect(url).toContain("https://istanablock.com/pola-paving?pd_share=");

      const parsedUrl = new URL(url);
      const code = parsedUrl.searchParams.get("pd_share");
      expect(code).toBeTruthy();
      const decoded = decodeShareStateFromBase64(code!);
      expect(decoded.cfg.productId).toBe("truepave");
    });
  });

  describe("WhatsApp Message Generator", () => {
    it("generates complete and structured Indonesian WhatsApp message", () => {
      const geom = createRectanglePreset(10, 5); // 50 m²
      const cfg: PatternConfig = {
        productId: "truepave",
        motifId: "bata",
        thicknessM: 0.06,
        reservePercent: 5,
      };

      const layout = generateLayout(geom, cfg);
      const estimate = calculateMaterialEstimate(layout, cfg);

      const msg = createWhatsAppMessage({
        whatsappNumber: "0812-3456-7890",
        shareUrl: "https://istanablock.com/pola-paving?pd_share=sample123",
        productName: "Truepave Bata (21 x 10,5 cm)",
        motifName: "Susun Bata Standar",
        geometry: geom,
        estimate,
        config: cfg,
      });

      expect(msg).toContain("PT Istana Block Purwakarta");
      expect(msg).toContain("Luas Lahan: 50 m²");
      expect(msg).toContain("Blok Utuh:");
      expect(msg).toContain("Potongan Batas Tepi:");
      expect(msg).toContain("TOTAL REKOMENDASI PEMBELIAN:");
      expect(msg).toContain("https://istanablock.com/pola-paving?pd_share=sample123");

      const link = createWhatsAppShareLink({
        whatsappNumber: "0812-3456-7890",
        shareUrl: "https://istanablock.com/pola-paving?pd_share=sample123",
        productName: "Truepave Bata (21 x 10,5 cm)",
        motifName: "Susun Bata Standar",
        geometry: geom,
        estimate,
        config: cfg,
      });

      expect(link.startsWith("https://wa.me/6281234567890?text=")).toBe(true);
    });
  });
});
