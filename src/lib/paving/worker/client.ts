/**
 * Client-Side Worker Dispatcher with Main-Thread Fallback
 * Provides transparent async execution whether Web Workers are supported or blocked.
 *
 * Satu worker dipakai ulang untuk semua permintaan layout. Permintaan yang digantikan
 * permintaan lebih baru tidak mematikan worker: hasil basinya dibuang, dan hanya permintaan
 * TERBARU yang menunggu giliran (antrean satu slot). Worker baru dibuat hanya bila hitungan
 * yang sedang berjalan sudah sangat lama (LONG_RUNNING_LAYOUT_MS), supaya permintaan baru
 * tidak menunggu hitungan basi yang berat.
 */

import { calculateMaterialEstimate } from "../engine/estimate";
import { generateLayout } from "../engine/layout";
import type { LayoutResult, MaterialEstimate, PatternConfig } from "../engine/types";
import type { ProjectGeometry } from "../geometry/types";
import { packLayout, type PackedLayoutResult } from "../render/packed-tiles";
import type { WorkerRequest, WorkerResponse } from "./types";

/**
 * Batas (ms) hitungan layout berjalan sebelum dianggap "sangat lama" dan worker-nya
 * dihentikan saat ada permintaan baru. Provisional: di bawah ini, menunggu selesai lebih
 * murah daripada memuat ulang modul worker.
 */
export const LONG_RUNNING_LAYOUT_MS = 2500;

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

type Handler = {
  resolve: (val: any) => void;
  reject: (err: any) => void;
};

interface QueuedLayout extends Handler {
  geometry: ProjectGeometry;
  config: PatternConfig;
}

let sharedWorker: Worker | null = null;
const pendingRequests = new Map<string, Handler>();
/** Id permintaan layout yang sedang dikerjakan worker (walau pemanggilnya sudah basi). */
let busyLayoutId: string | null = null;
let busySince = 0;
/** Permintaan layout terbaru yang menunggu worker bebas. Hanya satu slot. */
let queuedLayout: QueuedLayout | null = null;

let requestCounter = 0;
function nextId(prefix: string) {
  requestCounter += 1;
  return `${prefix}_${Date.now()}_${requestCounter}`;
}

/** Hentikan worker; semua permintaan tertunda & antrean ditolak dengan `err`. */
function resetWorker(err: Error) {
  for (const [id, handler] of pendingRequests.entries()) {
    handler.reject(err);
    pendingRequests.delete(id);
  }
  if (queuedLayout) {
    queuedLayout.reject(err);
    queuedLayout = null;
  }
  busyLayoutId = null;
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
        const wasBusy = res.requestId === busyLayoutId;
        if (wasBusy) busyLayoutId = null;

        const handler = pendingRequests.get(res.requestId);
        if (handler) {
          pendingRequests.delete(res.requestId);
          if (res.status === "success") {
            handler.resolve(res.result);
          } else {
            handler.reject(new Error(res.error));
          }
        }

        // Worker bebas: kerjakan permintaan terbaru yang menunggu.
        if (wasBusy && queuedLayout) {
          const next = queuedLayout;
          queuedLayout = null;
          postLayout(next.geometry, next.config).then(next.resolve, next.reject);
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

/** Kirim permintaan layout ke worker (worker diasumsikan bebas). */
function postLayout(geometry: ProjectGeometry, config: PatternConfig): Promise<PackedLayoutResult> {
  const worker = getWorker();
  if (!worker) return Promise.reject(new WorkerCrashError("Worker tidak tersedia"));

  const requestId = nextId("layout");
  return new Promise<PackedLayoutResult>((resolve, reject) => {
    pendingRequests.set(requestId, { resolve, reject });
    busyLayoutId = requestId;
    busySince = Date.now();
    const req: WorkerRequest = {
      requestId,
      operation: "generateLayout",
      payload: { geometry, config },
    };
    worker.postMessage(req);
  });
}

/** Tolak (basi) pemanggil permintaan layout yang sedang berjalan tanpa mematikan worker. */
function abandonBusyLayout() {
  if (!busyLayoutId) return;
  const handler = pendingRequests.get(busyLayoutId);
  if (handler) {
    pendingRequests.delete(busyLayoutId);
    handler.reject(new StaleLayoutError());
  }
}

/** Hitungan yang sedang berjalan sudah lebih lama dari batas "sangat lama". */
function busyTooLong(): boolean {
  return busyLayoutId !== null && Date.now() - busySince > LONG_RUNNING_LAYOUT_MS;
}

/**
 * Batalkan perhitungan layout yang menunggu/berjalan (hasilnya dibuang). Worker tetap hidup
 * kecuali hitungan berjalan sudah sangat lama. Untuk membuang worker, pakai disposeLayoutWorker.
 */
export function cancelPendingLayout() {
  if (queuedLayout) {
    queuedLayout.reject(new StaleLayoutError());
    queuedLayout = null;
  }
  if (busyLayoutId) {
    if (busyTooLong()) resetWorker(new StaleLayoutError());
    else abandonBusyLayout();
  }
}

/** Hentikan worker saat komponen dilepas (idle maupun sedang menghitung). */
export function disposeLayoutWorker() {
  resetWorker(new StaleLayoutError());
}

/**
 * Execute layout generation asynchronously via Worker (or main thread fallback).
 * Permintaan lama ditolak dengan StaleLayoutError saat permintaan baru datang; worker dipakai
 * ulang (lihat catatan modul).
 */
export async function executeLayoutAsync(
  geometry: ProjectGeometry,
  config: PatternConfig,
): Promise<PackedLayoutResult> {
  const worker = getWorker();
  if (!worker) {
    // Synchronous fallback
    return packLayout(generateLayout(geometry, config));
  }

  // Permintaan yang masih mengantre digantikan yang ini.
  if (queuedLayout) {
    queuedLayout.reject(new StaleLayoutError());
    queuedLayout = null;
  }

  try {
    if (busyLayoutId) {
      if (busyTooLong()) {
        // Hitungan basi sangat lama: mulai worker baru agar yang terbaru tidak menunggu.
        resetWorker(new StaleLayoutError());
      } else {
        // Worker masih sibuk: buang pemanggil lama, tunggu giliran sebagai permintaan terbaru.
        abandonBusyLayout();
        return await new Promise<PackedLayoutResult>((resolve, reject) => {
          queuedLayout = { geometry, config, resolve, reject };
        });
      }
    }
    return await postLayout(geometry, config);
  } catch (err) {
    if (err instanceof WorkerCrashError) return packLayout(generateLayout(geometry, config));
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

  const requestId = nextId("est");

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
