/**
 * Client-Side Worker Dispatcher with Main-Thread Fallback
 * Provides transparent async execution whether Web Workers are supported or blocked.
 */

import { calculateMaterialEstimate } from "../engine/estimate";
import { generateLayout } from "../engine/layout";
import type { LayoutResult, MaterialEstimate, PatternConfig } from "../engine/types";
import type { ProjectGeometry } from "../geometry/types";
import type { WorkerRequest, WorkerResponse } from "./types";

let sharedWorker: Worker | null = null;
const pendingRequests = new Map<
  string,
  {
    resolve: (val: any) => void;
    reject: (err: any) => void;
  }
>();

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
        // Reject all pending and reset
        for (const [id, handler] of pendingRequests.entries()) {
          handler.reject(err);
          pendingRequests.delete(id);
        }
        sharedWorker?.terminate();
        sharedWorker = null;
      };
    } catch {
      sharedWorker = null;
    }
  }

  return sharedWorker;
}

/**
 * Execute layout generation asynchronously via Worker (or main thread fallback)
 */
export async function executeLayoutAsync(
  geometry: ProjectGeometry,
  config: PatternConfig,
): Promise<LayoutResult> {
  const worker = getWorker();
  if (!worker) {
    // Synchronous fallback
    return generateLayout(geometry, config);
  }

  const requestId = `layout_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  return new Promise<LayoutResult>((resolve, reject) => {
    pendingRequests.set(requestId, { resolve, reject });
    const req: WorkerRequest = {
      requestId,
      operation: "generateLayout",
      payload: { geometry, config },
    };
    worker.postMessage(req);
  });
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
    pendingRequests.set(requestId, { resolve, reject });
    const req: WorkerRequest = {
      requestId,
      operation: "calculateEstimate",
      payload: { layout, config },
    };
    worker.postMessage(req);
  });
}
