/**
 * Web Worker for Layout Engine & Clipping Calculations
 * Completely isolated from main thread UI interactions.
 */

import { calculateMaterialEstimate } from "../engine/estimate";
import { generateLayout } from "../engine/layout";
import { packLayout, packedTransferables } from "../render/packed-tiles";
import type {
  CalculateEstimatePayload,
  GenerateLayoutPayload,
  WorkerRequest,
  WorkerResponse,
} from "./types";

/* eslint-disable no-restricted-globals */
const ctx: Worker = self as unknown as Worker;

ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  if (!req || !req.requestId) return;

  try {
    if (req.operation === "generateLayout") {
      const payload = req.payload as GenerateLayoutPayload;
      // Kemas keping ke typed array lalu PINDAHKAN (transfer): main thread tidak perlu
      // mendeserialisasi ratusan ribu objek (lihat render/packed-tiles).
      const result = packLayout(generateLayout(payload.geometry, payload.config));
      const response: WorkerResponse = {
        requestId: req.requestId,
        status: "success",
        operation: "generateLayout",
        result,
      };
      ctx.postMessage(response, packedTransferables(result.packed));
    } else if (req.operation === "calculateEstimate") {
      const payload = req.payload as CalculateEstimatePayload;
      const result = calculateMaterialEstimate(payload.layout, payload.config);
      const response: WorkerResponse = {
        requestId: req.requestId,
        status: "success",
        operation: "calculateEstimate",
        result,
      };
      ctx.postMessage(response);
    } else {
      throw new Error(`Operasi worker tidak dikenal: ${(req as any).operation}`);
    }
  } catch (err: any) {
    const errorResponse: WorkerResponse = {
      requestId: req.requestId,
      status: "error",
      operation: req.operation,
      error: err?.message || "Terjadi kesalahan internal pada kalkulasi layout Worker.",
    };
    ctx.postMessage(errorResponse);
  }
};
