/**
 * Client-Side Worker Dispatcher with Main-Thread Fallback
 * Provides transparent async execution whether Web Workers are supported or blocked.
 */

import { calculateMaterialEstimate } from "../engine/estimate";
import { generateLayout } from "../engine/layout";
import type { LayoutResult, MaterialEstimate, PatternConfig } from "../engine/types";
import type { ProjectGeometry } from "../geometry/types";
import type { WorkerRequest, WorkerResponse } from "./types";

/** Permintaan digantikan permintaan yang lebih baru (hasilnya basi, dibuang). */
export class StaleLayoutError extends Error {
  constructor() {
    super("Perhitungan layout digantikan permintaan yang lebih baru.");
    this.name = "StaleLayoutError";
  }
}

/** Worker gagal dimuat/mati (bukan galat perhitungan); pemanggil boleh jatuh ke main thread. */
class WorkerCrashError extends Error {
  constructor(cause: unknown) {
    super("Web Worker layout gagal berjalan.");
    this.name = "WorkerCrashError";
    (this as { cause?: unknown }).cause = cause;
  }
}

let sharedWorker: Worker | null = null;
const pendingRequests = new Map<
  string,
  {
    kind: "layout" | "estimate";
    resolve: (val: any) => void;
    reject: (err: any) => void;
  }
>();

/** Hentikan worker; semua permintaan tertunda ditolak dengan `err`. */
function resetWorker(err: Error) {
  for (const [id, handler] of pendingRequests.entries()) {
    handler.reject(err);
    pendingRequests.delete(id);
  }
  sharedWorker?.terminate();
  sharedWorker = null;
}

function getWorker(): Worker | null {
  if (typeof globalThis === "undefined" || typeof Worker === "undefined") {
    return null;
  }

  if (!sharedWorker) {
    try {
      sharedWorker = new Worker(new URL("./layout.worker.ts", import.meta.url), {
        type: "module",
      });

      sharedWorker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const res = event.data;
        const handler = pendingRequests.get(res.requestId);
        if (!handler) return;

        pendingRequests.delete(res.requestId);
        if (res.status === "success") {
          handler.resolve(res.result);
        } else {
          handler.reject(new Error(res.error));
        }
      };

      sharedWorker.onerror = (err) => {
        resetWorker(new WorkerCrashError(err));
      };
    } catch {
      sharedWorker = null;
    }
  }

  return sharedWorker;
}

/** Batalkan perhitungan layout yang sedang berjalan (mis. komponen dilepas). */
export function cancelPendingLayout() {
  if ([...pendingRequests.values()].some((h) => h.kind === "layout")) {
    resetWorker(new StaleLayoutError());
  }
}

/**
 * Execute layout generation asynchronously via Worker (or main thread fallback).
 * Permintaan layout yang masih berjalan dibatalkan (worker dihentikan) dan ditolak dengan
 * StaleLayoutError saat permintaan baru datang, sehingga hasil basi tidak menghalangi yang terbaru.
 */
export async function executeLayoutAsync(
  geometry: ProjectGeometry,
  config: PatternConfig,
): Promise<LayoutResult> {
  const hasPendingLayout = [...pendingRequests.values()].some((h) => h.kind === "layout");
  if (hasPendingLayout) resetWorker(new StaleLayoutError());

  const worker = getWorker();
  if (!worker) {
    // Synchronous fallback
    return generateLayout(geometry, config);
  }

  const requestId = `layout_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  try {
    return await new Promise<LayoutResult>((resolve, reject) => {
      pendingRequests.set(requestId, { kind: "layout", resolve, reject });
      const req: WorkerRequest = {
        requestId,
        operation: "generateLayout",
        payload: { geometry, config },
      };
      worker.postMessage(req);
    });
  } catch (err) {
    if (err instanceof WorkerCrashError) return generateLayout(geometry, config);
    throw err;
  }
}

/**
 * Execute material estimation asynchronously via Worker (or main thread fallback)
 */
export async function executeEstimateAsync(
  layout: LayoutResult,
  config: PatternConfig,
): Promise<MaterialEstimate> {
  const worker = getWorker();
  if (!worker) {
    return calculateMaterialEstimate(layout, config);
  }

  const requestId = `est_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  return new Promise<MaterialEstimate>((resolve, reject) => {
    pendingRequests.set(requestId, { kind: "estimate", resolve, reject });
    const req: WorkerRequest = {
      requestId,
      operation: "calculateEstimate",
      payload: { layout, config },
    };
    worker.postMessage(req);
  });
}
