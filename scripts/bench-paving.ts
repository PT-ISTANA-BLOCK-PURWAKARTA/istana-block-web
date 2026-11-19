/**
 * Ukur waktu engine layout (tanpa worker, tanpa render) untuk lahan persegi.
 * Jalankan: npx tsx scripts/bench-paving.ts
 * Tiap skenario: 1 pemanasan + 5 ulangan, dilaporkan median dan rentang.
 */
import { createRectanglePreset } from "../src/lib/paving/adapters/preset";
import { generateLayout } from "../src/lib/paving/engine/layout";
import { calculateMaterialEstimate } from "../src/lib/paving/engine/estimate";
import type { PatternConfig } from "../src/lib/paving/engine/types";

const cfg: PatternConfig = { productId: "truepave", motifId: "bata", thicknessM: 0.06, reservePercent: 5, rotationDeg: 0 };
const scenarios: Array<[string, number, number]> = [
  ["50 m2", 10, 5],
  ["600 m2", 30, 20],
  ["5.000 m2", 100, 50],
];

for (const [name, w, h] of scenarios) {
  const geom = createRectanglePreset(w, h);
  generateLayout(geom, cfg);
  const times: number[] = [];
  let tiles = 0;
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    const layout = generateLayout(geom, cfg);
    times.push(performance.now() - t0);
    tiles = layout.tiles.length;
    if (i === 0) calculateMaterialEstimate(layout, cfg);
  }
  times.sort((a, b) => a - b);
  console.log(`${name}\tkeping=${tiles}\tmedian=${times[2].toFixed(0)} ms\tmin=${times[0].toFixed(0)}\tmax=${times[4].toFixed(0)}`);
}
