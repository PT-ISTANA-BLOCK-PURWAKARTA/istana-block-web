// Usage:
//   node render.mjs <land|vert> stills <t1,t2,...> <outdir>
//   node render.mjs <land|vert> video <out.mkv> [vo]   (tambahkan "vo" untuk versi 28,6 dtk yang mengikuti voice-over)
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

const [fmt, mode, a1, a2] = process.argv.slice(2);
const B = process.env.REEL_BASE || "http://localhost:8787"; // jalankan `npm run preview` dulu
const home = await (await fetch(B + "/")).text();
const css = home.match(/\/_next\/static\/css\/[^"]+\.css/)[0];
const html = readFileSync(new URL("./reel.html", import.meta.url), "utf8").replace("__CSS__", css);
const size = fmt === "land" ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 };
const FPS = 30;
// VO version: output time u -> original scene time t (piecewise linear; holds stretch where the voice needs room)
const VO_MAP = [[0, 0], [1.9, 1.9], [4.2, 2.5], [5.1, 3.4], [8.5, 6.8], [8.6, 6.9], [12.6, 9.7], [13.85, 10.95], [16.7, 14.0], [19.15, 16.45], [21.3, 18.6], [22.6, 19.9], [28.2, 21.6], [28.6, 22.0]];
const useMap = (a2 === "vo") || process.env.VO === "1";
const DUR = useMap ? 28.6 : 22.0;
function mapT(u) {
  if (!useMap) return u;
  for (let i = 0; i < VO_MAP.length - 1; i++) {
    const [u0, t0] = VO_MAP[i], [u1, t1] = VO_MAP[i + 1];
    if (u <= u1) return t0 + (t1 - t0) * ((u - u0) / (u1 - u0));
  }
  return 22.0;
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("pageerror", e.message));
await page.route(`${B}/__reel*`, (r) => r.fulfill({ contentType: "text/html; charset=utf-8", body: html }));
await page.goto(`${B}/__reel?fmt=${fmt}`, { waitUntil: "load" });
await page.waitForFunction(() => window.reelReady === true, null, { timeout: 60000 });
console.log("wa:", await page.evaluate(() => window.__wa.waText));

if (mode === "stills") {
  for (const t of a1.split(",").map(Number)) {
    await page.evaluate((t) => window.render(t), t);
    await page.screenshot({ path: `${a2}/${fmt}-${t.toFixed(2)}.png` });
  }
} else {
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
    "-c:v", "libx264", "-preset", "medium", "-crf", "12", "-pix_fmt", "yuv420p", a1], { stdio: ["pipe", "inherit", "inherit"] });
  const N = Math.round(DUR * FPS);
  for (let i = 0; i < N; i++) {
    await page.evaluate(([t, u]) => window.render(t, u), [mapT(i / FPS), i / FPS]);
    const buf = await page.screenshot({ type: "png" });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (i % 60 === 0) console.log(`${fmt} frame ${i}/${N}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
}
await browser.close();
