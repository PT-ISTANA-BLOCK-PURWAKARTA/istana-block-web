/**
 * Typed Web Worker Contract for Paving Designer
 * Offloads heavy geometric clipping and layout generation off the main thread.
 */

import type { MaterialEstimate, PatternConfig } from "../engine/types";
import type { LayoutResult } from "../engine/types";
import type { ProjectGeometry } from "../geometry/types";

export type WorkerOperation = "generateLayout" | "calculateEstimate";

export interface GenerateLayoutPayload {
  geometry: ProjectGeometry;
  config: PatternConfig;
}

export interface CalculateEstimatePayload {
  layout: LayoutResult;
  config: PatternConfig;
}

export interface WorkerRequest {
  requestId: string;
  operation: WorkerOperation;
  payload: GenerateLayoutPayload | CalculateEstimatePayload;
}

export interface WorkerSuccessResponse {
  requestId: string;
  status: "success";
  operation: WorkerOperation;
  result: LayoutResult | MaterialEstimate;
}

export interface WorkerErrorResponse {
  requestId: string;
  status: "error";
  operation: WorkerOperation;
  error: string;
}

export type WorkerResponse = WorkerSuccessResponse | WorkerErrorResponse;
