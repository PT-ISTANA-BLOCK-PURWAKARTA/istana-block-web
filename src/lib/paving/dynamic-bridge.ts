export {
  createLShapePreset,
  createRectanglePreset,
  createTrapezoidPreset,
  createUShapePreset,
} from "./adapters/preset";
export { PAVING_CATALOG } from "./catalog";
export { calculateMaterialEstimate } from "./engine/estimate";
export { generateLayout } from "./engine/layout";
export {
  buildShareUrl,
  createWhatsAppShareLink,
  decodeShareStateFromBase64,
  readShareCode,
  type ShareState,
} from "./share";
export { geometryToShareGeom, shareGeomToGeometry } from "./share-geometry";
export { splitColorsByPackedRoles } from "./engine/color-split";
export {
  cancelPendingLayout,
  disposeLayoutWorker,
  executeLayoutAsync,
  StaleLayoutError,
} from "./worker/client";
