import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRectanglePreset } from "../adapters/preset";
import type { PatternConfig } from "../engine/types";
import type { WorkerRequest } from "../worker/types";

const cfg: PatternConfig = {
  productId: "fp30",
  motifId: "lurus",
  thicknessM: 0.06,
  reservePercent: 0,
  originM: { x: 0, y: 0 },
  rotationDeg: 0,
};
const geom = createRectanglePreset(3, 2);

/** Worker palsu: menyimpan pesan, balasan dikirim manual lewat reply(). */
class FakeWorker {
  static instances: FakeWorker[] = [];
  posted: WorkerRequest[] = [];
  terminated = false;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(req: WorkerRequest) {
    this.posted.push(req);
  }
  terminate() {
    this.terminated = true;
  }
  reply(index: number, result: unknown = { fake: index }) {
    const req = this.posted[index];
    this.onmessage?.({
      data: { requestId: req.requestId, status: "success", operation: req.operation, result },
    });
  }
}

async function load() {
  vi.resetModules();
  return import("../worker/client");
}

describe("worker/client: pakai ulang worker, hanya permintaan terbaru", () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    vi.stubGlobal("Worker", FakeWorker);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("permintaan berurutan memakai satu worker yang sama", async () => {
    const c = await load();
    const p1 = c.executeLayoutAsync(geom, cfg);
    const w = FakeWorker.instances[0];
    w.reply(0, "A");
    await expect(p1).resolves.toBe("A");

    const p2 = c.executeLayoutAsync(geom, cfg);
    expect(FakeWorker.instances).toHaveLength(1);
    expect(w.posted).toHaveLength(2);
    w.reply(1, "B");
    await expect(p2).resolves.toBe("B");
    expect(w.terminated).toBe(false);
  });

  it("permintaan baru saat sibuk tidak mematikan worker; yang lama basi, hanya yang terbaru jalan", async () => {
    const c = await load();
    const p1 = c.executeLayoutAsync(geom, cfg);
    const p2 = c.executeLayoutAsync(geom, cfg);
    const p3 = c.executeLayoutAsync(geom, cfg);
    const w = FakeWorker.instances[0];

    await expect(p1).rejects.toBeInstanceOf(c.StaleLayoutError);
    await expect(p2).rejects.toBeInstanceOf(c.StaleLayoutError);
    // Hanya permintaan pertama yang sudah dikirim; p3 menunggu giliran.
    expect(w.posted).toHaveLength(1);

    w.reply(0, "basi");
    expect(w.posted).toHaveLength(2);
    w.reply(1, "terbaru");
    await expect(p3).resolves.toBe("terbaru");

    expect(FakeWorker.instances).toHaveLength(1);
    expect(w.terminated).toBe(false);
  });

  it("hitungan basi sangat lama: worker dihentikan dan yang baru langsung jalan", async () => {
    const c = await load();
    const p1 = c.executeLayoutAsync(geom, cfg);
    const first = FakeWorker.instances[0];
    vi.setSystemTime(Date.now() + c.LONG_RUNNING_LAYOUT_MS + 1);

    const p2 = c.executeLayoutAsync(geom, cfg);
    await expect(p1).rejects.toBeInstanceOf(c.StaleLayoutError);
    expect(first.terminated).toBe(true);
    expect(FakeWorker.instances).toHaveLength(2);
    const second = FakeWorker.instances[1];
    expect(second.posted).toHaveLength(1);
    second.reply(0, "baru");
    await expect(p2).resolves.toBe("baru");
  });

  it("balasan worker lama yang basi tidak memicu hasil untuk pemanggil lain", async () => {
    const c = await load();
    const p1 = c.executeLayoutAsync(geom, cfg);
    const w = FakeWorker.instances[0];
    const p2 = c.executeLayoutAsync(geom, cfg);
    await expect(p1).rejects.toBeInstanceOf(c.StaleLayoutError);
    w.reply(0, "basi");
    w.reply(1, "ok");
    await expect(p2).resolves.toBe("ok");
  });

  it("disposeLayoutWorker menghentikan worker idle", async () => {
    const c = await load();
    const p1 = c.executeLayoutAsync(geom, cfg);
    const w = FakeWorker.instances[0];
    w.reply(0, "x");
    await p1;
    c.disposeLayoutWorker();
    expect(w.terminated).toBe(true);
  });

  it("disposeLayoutWorker menolak permintaan yang sedang berjalan sebagai basi", async () => {
    const c = await load();
    const p1 = c.executeLayoutAsync(geom, cfg);
    c.disposeLayoutWorker();
    await expect(p1).rejects.toBeInstanceOf(c.StaleLayoutError);
  });

  it("tanpa Worker: jatuh ke hitungan main thread", async () => {
    vi.stubGlobal("Worker", undefined);
    const c = await load();
    const result = await c.executeLayoutAsync(geom, cfg);
    expect(result.metrics.siteAreaM2).toBeCloseTo(6, 6);
    expect(result.packed.count).toBeGreaterThan(0);
  });
});
