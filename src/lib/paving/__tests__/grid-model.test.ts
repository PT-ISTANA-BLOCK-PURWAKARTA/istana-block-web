import { describe, expect, it } from "vitest";
import {
  DEFAULT_VIEW,
  MAX_HISTORY,
  MAX_SPAN,
  MIN_SPAN,
  clampSpan,
  fitToPoints,
  fracToWorld,
  gridLineValues,
  gridReducer,
  gridStep,
  initialGridState,
  nearestPointIndex,
  panByFrac,
  pinchView,
  snapValue,
  toClosedRing,
  worldToFrac,
  zoomAt,
  type GridAction,
  type GridState,
} from "../grid-model";

const run = (actions: GridAction[], from: GridState = initialGridState) => actions.reduce(gridReducer, from);

describe("gridReducer", () => {
  const sq: GridAction[] = [
    { type: "add", pt: [0, 0] },
    { type: "add", pt: [4, 0] },
    { type: "add", pt: [4, 3] },
  ];

  it("menambah titik", () => {
    expect(run(sq).points).toEqual([
      [0, 0],
      [4, 0],
      [4, 3],
    ]);
  });

  it("tidak menutup bila titik kurang dari 3", () => {
    const s = run([{ type: "add", pt: [0, 0] }, { type: "add", pt: [1, 0] }, { type: "close" }]);
    expect(s.closed).toBe(false);
  });

  it("menutup lalu mengabaikan penambahan titik", () => {
    const s = run([...sq, { type: "close" }, { type: "add", pt: [9, 9] }]);
    expect(s.closed).toBe(true);
    expect(s.points).toHaveLength(3);
  });

  it("menggeser titik dengan satu entri riwayat per seretan", () => {
    const base = run(sq);
    const pastBefore = base.past.length;
    const s = run(
      [
        { type: "moveStart" },
        { type: "move", index: 1, pt: [5, 0] },
        { type: "move", index: 1, pt: [6, 0] },
        { type: "move", index: 1, pt: [7, 1] },
      ],
      base,
    );
    expect(s.points[1]).toEqual([7, 1]);
    expect(s.past.length).toBe(pastBefore + 1);
    const undone = gridReducer(s, { type: "undo" });
    expect(undone.points[1]).toEqual([4, 0]);
  });

  it("move dengan indeks di luar jangkauan diabaikan", () => {
    const base = run(sq);
    expect(gridReducer(base, { type: "move", index: 9, pt: [1, 1] })).toBe(base);
  });

  it("menghapus titik terpilih; di bawah 3 titik poligon terbuka lagi", () => {
    const closed = run([...sq, { type: "close" }]);
    const s = gridReducer(closed, { type: "remove", index: 0 });
    expect(s.points).toHaveLength(2);
    expect(s.closed).toBe(false);
  });

  it("menghapus titik pada poligon 4 titik tetap tertutup", () => {
    const s = run([...sq, { type: "add", pt: [0, 3] }, { type: "close" }, { type: "remove", index: 3 }]);
    expect(s.points).toHaveLength(3);
    expect(s.closed).toBe(true);
  });

  it("urung membatalkan tambah, tutup, hapus, dan reset secara berurutan", () => {
    let s = run([...sq, { type: "close" }]);
    s = gridReducer(s, { type: "undo" }); // batal tutup
    expect(s.closed).toBe(false);
    expect(s.points).toHaveLength(3);
    s = gridReducer(s, { type: "undo" }); // batal titik ke-3
    expect(s.points).toHaveLength(2);
    s = gridReducer(s, { type: "reset" });
    expect(s.points).toHaveLength(0);
    s = gridReducer(s, { type: "undo" }); // batal reset
    expect(s.points).toHaveLength(2);
  });

  it("urung pada state awal tidak berbuat apa-apa", () => {
    expect(gridReducer(initialGridState, { type: "undo" })).toBe(initialGridState);
  });

  it("riwayat dibatasi", () => {
    let s = initialGridState;
    for (let i = 0; i < MAX_HISTORY + 30; i++) s = gridReducer(s, { type: "add", pt: [i, 0] });
    expect(s.past).toHaveLength(MAX_HISTORY);
  });

  it("memilih titik", () => {
    const s = gridReducer(run(sq), { type: "select", index: 2 });
    expect(s.selected).toBe(2);
    expect(gridReducer(s, { type: "select", index: 7 })).toBe(s);
  });
});

describe("util titik", () => {
  it("toClosedRing mengulang titik pertama dan tidak mengubah masukan", () => {
    const pts: Array<[number, number]> = [
      [0, 0],
      [2, 0],
      [2, 2],
    ];
    const ring = toClosedRing(pts);
    expect(ring).toHaveLength(4);
    expect(ring[3]).toEqual([0, 0]);
    expect(pts).toHaveLength(3);
  });

  it("snapValue membulatkan ke kelipatan tanpa ekor desimal", () => {
    expect(snapValue(1.26, 0.5)).toBe(1.5);
    expect(snapValue(0.3, 0.1)).toBe(0.3);
    expect(snapValue(3.7, 0)).toBe(3.7);
  });

  it("nearestPointIndex memilih titik terdekat dalam radius", () => {
    const pts: Array<[number, number]> = [
      [0, 0],
      [5, 5],
      [5.4, 5],
    ];
    expect(nearestPointIndex(pts, [5.3, 5], 0.5)).toBe(2);
    expect(nearestPointIndex(pts, [9, 9], 0.5)).toBe(-1);
  });
});

describe("matematika tampilan", () => {
  it("fracToWorld dan worldToFrac saling balik", () => {
    const v = { cx: 3, cy: -2, span: 40 };
    const w = fracToWorld(v, [0.25, 0.8]);
    const f = worldToFrac(v, w);
    expect(f[0]).toBeCloseTo(0.25, 9);
    expect(f[1]).toBeCloseTo(0.8, 9);
  });

  it("pusat kanvas = pusat tampilan; sumbu y naik ke atas", () => {
    expect(fracToWorld(DEFAULT_VIEW, [0.5, 0.5])).toEqual([10, 10]);
    expect(fracToWorld(DEFAULT_VIEW, [0, 0])).toEqual([0, 20]);
    expect(fracToWorld(DEFAULT_VIEW, [1, 1])).toEqual([20, 0]);
  });

  it("zoomAt menjaga titik jangkar tetap di tempatnya", () => {
    const anchor: [number, number] = [0.3, 0.7];
    const before = fracToWorld(DEFAULT_VIEW, anchor);
    const z = zoomAt(DEFAULT_VIEW, 0.5, anchor);
    expect(z.span).toBe(10);
    const after = fracToWorld(z, anchor);
    expect(after[0]).toBeCloseTo(before[0], 9);
    expect(after[1]).toBeCloseTo(before[1], 9);
  });

  it("zoom dijepit ke batas", () => {
    expect(zoomAt(DEFAULT_VIEW, 1e-6).span).toBe(MIN_SPAN);
    expect(zoomAt(DEFAULT_VIEW, 1e6).span).toBe(MAX_SPAN);
    expect(clampSpan(1)).toBe(MIN_SPAN);
  });

  it("panByFrac: isi mengikuti jari (jari ke kanan, pusat ke kiri)", () => {
    const p = panByFrac(DEFAULT_VIEW, 0.1, 0);
    expect(p.cx).toBeCloseTo(8, 9);
    const q = panByFrac(DEFAULT_VIEW, 0, 0.1); // jari turun, pusat naik
    expect(q.cy).toBeCloseTo(12, 9);
  });

  it("pinchView: renggangkan jari = zoom in, titik tengah tetap melekat pada isi", () => {
    const startMid: [number, number] = [0.5, 0.5];
    const z = pinchView(DEFAULT_VIEW, startMid, 100, startMid, 200);
    expect(z.span).toBeCloseTo(10, 9);
    expect(z.cx).toBeCloseTo(10, 9);

    // jari bergeser ke kanan sambil cubit: titik dunia awal harus ada di titik tengah baru
    const mid: [number, number] = [0.6, 0.4];
    const t = pinchView(DEFAULT_VIEW, startMid, 100, mid, 100);
    const w0 = fracToWorld(DEFAULT_VIEW, startMid);
    const w1 = fracToWorld(t, mid);
    expect(w1[0]).toBeCloseTo(w0[0], 9);
    expect(w1[1]).toBeCloseTo(w0[1], 9);
  });

  it("pinchView menolak jarak nol", () => {
    expect(pinchView(DEFAULT_VIEW, [0.5, 0.5], 0, [0.5, 0.5], 10)).toBe(DEFAULT_VIEW);
  });

  it("fitToPoints memuat semua titik dengan ruang di sekelilingnya", () => {
    const pts: Array<[number, number]> = [
      [100, 100],
      [160, 100],
      [160, 130],
    ];
    const v = fitToPoints(pts);
    expect(v.cx).toBe(130);
    expect(v.cy).toBe(115);
    expect(v.span).toBeGreaterThanOrEqual(60);
    for (const p of pts) {
      const [fx, fy] = worldToFrac(v, p);
      expect(fx).toBeGreaterThan(0);
      expect(fx).toBeLessThan(1);
      expect(fy).toBeGreaterThan(0);
      expect(fy).toBeLessThan(1);
    }
  });

  it("fitToPoints tanpa titik memberi tampilan awal; bentuk kecil memakai span minimum", () => {
    expect(fitToPoints([])).toBe(DEFAULT_VIEW);
    expect(
      fitToPoints([
        [1, 1],
        [2, 2],
      ]).span,
    ).toBe(10);
  });
});

describe("grid adaptif", () => {
  it("langkah garis memakai deret 1-2-5", () => {
    expect(gridStep(20)).toBe(2);
    expect(gridStep(10)).toBe(1);
    expect(gridStep(100)).toBe(10);
    expect(gridStep(400)).toBe(20);
    expect(gridStep(2)).toBe(0.2);
  });

  it("jumlah garis terlihat tetap wajar di semua zoom", () => {
    for (const span of [2, 5, 20, 60, 150, 400]) {
      const n = gridLineValues(0, span, gridStep(span)).length;
      expect(n).toBeGreaterThanOrEqual(6);
      expect(n).toBeLessThanOrEqual(26);
    }
  });

  it("gridLineValues kelipatan langkah di dalam rentang", () => {
    expect(gridLineValues(-1.2, 5.1, 2)).toEqual([0, 2, 4]);
    expect(gridLineValues(0, 1, 0)).toEqual([]);
  });
});
