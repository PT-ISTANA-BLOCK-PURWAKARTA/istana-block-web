/**
 * Legacy Computation & State Handling
 * Extracted from PatternCalculator.tsx for characterization and regression safety.
 */

import type {
  CalcState,
  ColorId,
  ProductId,
  Query,
  Share,
} from "./types";
import {
  CAD_OPTIONS,
  COLORS,
  DEFAULT_W,
  isColor,
} from "./types";
import {
  isProduct,
  motifOf,
  PRODUCTS,
  roleCounts,
  unitOf,
} from "./patterns";

/** Format Indonesia: 1.234,5 (tanpa bergantung pada Intl agar server & peramban selalu sama). */
export function fmt(n: number, dec = 2) {
  if (!Number.isFinite(n)) return "–";
  const [i, d = ""] = Math.abs(n).toFixed(dec).split(".");
  const frac = d.replace(/0+$/, "");
  return (n < 0 ? "-" : "") + i.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (frac ? "," + frac : "");
}

export const fmtPct = (share: number) => `${fmt(share * 100, 1)}%`;

/** Terima "12,5", "12.5", atau "1.234,5". Kosong/tidak valid → NaN. */
export function parseNum(s: string) {
  let t = (s ?? "").trim().replace(/\s/g, "");
  if (!t) return NaN;
  if (t.includes(",") && t.includes(".")) t = t.replace(/\./g, "").replace(",", ".");
  else t = t.replace(",", ".");
  if (!/^\d*\.?\d+$|^\d+\.$/.test(t)) return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/** Pembulatan ke atas yang kebal galat floating point: 0,5 × 10 m × 44 × 1,10 = 242,00000000000003 harus 242, bukan 243. */
export const ceilSafe = (x: number) => Math.ceil(Math.round(x * 1e6) / 1e6);

export const cleanNum = (v: string | undefined) => (v ?? "").replace(/[^0-9.,]/g, "").slice(0, 12).replace(".", ",");

export function decodeState(q: Query): CalcState {
  const get = (k: string) => {
    const v = q[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const jenisQ = get("jenis");
  const jenis: ProductId = isProduct(jenisQ) ? jenisQ : "truepave";
  const P = PRODUCTS[jenis];
  const m = motifOf(jenis, get("motif") ?? "");
  const wq = (get("warna") ?? "").toUpperCase();
  const warna = DEFAULT_W.map((d, i) => (isColor(wq[i] ?? "") ? (wq[i] as ColorId) : d));
  const tebal = Number(get("tebal"));
  const cad = Number(get("cad"));
  const kq = get("kanstin");
  const persen: Partial<Record<ColorId, string>> = {};
  for (const part of (get("persen") ?? "").split("_")) {
    const c = part.charAt(0).toUpperCase();
    const v = parseNum(part.slice(1));
    if (isColor(c) && v >= 0 && v <= 100) persen[c] = fmt(v, 1);
  }
  return {
    jenis,
    motif: m.id,
    warna,
    tebal: P.tebal.includes(tebal) ? tebal : P.tebal[0],
    mode: get("mode") === "luas" ? "luas" : "pl",
    p: cleanNum(get("p")),
    l: cleanNum(get("l")),
    luas: cleanNum(get("luas")),
    cad: get("cad") != null && CAD_OPTIONS.includes(cad) ? cad : m.cad,
    k: kq !== "0",
    ks: kq === "60" ? 60 : 40,
    kp: cleanNum(get("kp")),
    abu: get("abu") !== "0",
    bc: get("bc") === "1",
    manual: Object.keys(persen).length > 0,
    persen,
  };
}

export const urlNum = (v: string) => {
  const n = parseNum(v);
  return Number.isFinite(n) ? String(n) : "";
};

/** Pilihan → query string pendek & terbaca, mis. ?jenis=truepave&motif=tulang90&warna=NM&p=10&l=5 */
export function encodeState(st: CalcState) {
  const P = PRODUCTS[st.jenis];
  const m = motifOf(st.jenis, st.motif);
  const q = new URLSearchParams();
  q.set("jenis", st.jenis);
  q.set("motif", m.id);
  if (P.colors.length > 1) q.set("warna", effectiveColors(st).join(""));
  if (st.tebal !== P.tebal[0]) q.set("tebal", String(st.tebal));
  if (st.mode === "luas") {
    q.set("mode", "luas");
    if (urlNum(st.luas)) q.set("luas", urlNum(st.luas));
  } else {
    if (urlNum(st.p)) q.set("p", urlNum(st.p));
    if (urlNum(st.l)) q.set("l", urlNum(st.l));
  }
  if (st.cad !== m.cad) q.set("cad", String(st.cad));
  if (!st.k) q.set("kanstin", "0");
  else {
    if (st.ks === 60) q.set("kanstin", "60");
    if (urlNum(st.kp)) q.set("kp", urlNum(st.kp));
  }
  if (!st.abu) q.set("abu", "0");
  if (st.bc) q.set("bc", "1");
  if (st.manual) {
    const parts = autoShares(st)
      .slice(1)
      .map((x) => (urlNum(st.persen[x.c] ?? "") ? x.c + urlNum(st.persen[x.c] ?? "") : ""))
      .filter(Boolean);
    if (parts.length) q.set("persen", parts.join("_"));
  }
  return q;
}

export function effectiveColors(st: CalcState): ColorId[] {
  const P = PRODUCTS[st.jenis];
  const m = motifOf(st.jenis, st.motif);
  return Array.from({ length: m.roles }, (_, i) => (P.colors.includes(st.warna[i]) ? st.warna[i] : P.colors[0]));
}

/** Bagian tiap warna dihitung dari isi satu satuan pola; peran dengan warna sama digabung. */
export function autoShares(st: CalcState): Share[] {
  const counts = roleCounts(unitOf(st.jenis, st.motif));
  const colors = effectiveColors(st);
  const total = counts.reduce((a, b) => a + b, 0);
  const out: Share[] = [];
  colors.forEach((c, role) => {
    const s = counts[role] / total;
    const hit = out.find((x) => x.c === c);
    if (hit) hit.share += s;
    else out.push({ c, share: s });
  });
  return out.filter((x) => x.share > 0);
}

export function compute(st: CalcState) {
  const P = PRODUCTS[st.jenis];
  const m = motifOf(st.jenis, st.motif);
  const auto = autoShares(st);
  let shares = auto;
  let manualErr = "";
  if (st.manual && auto.length > 1) {
    const acc = auto.slice(1).map((x) => {
      const raw = st.persen[x.c];
      return { c: x.c, v: raw == null || raw.trim() === "" ? x.share * 100 : parseNum(raw) };
    });
    const sum = acc.reduce((a, b) => a + b.v, 0);
    if (acc.some((x) => !Number.isFinite(x.v) || x.v < 0 || x.v > 100)) manualErr = "Isi persentase dengan angka 0–100.";
    else if (sum > 100 + 1e-9) manualErr = `Jumlah persentase aksen ${fmt(sum, 1)}%, melebihi 100%.`;
    else shares = [{ c: auto[0].c, share: (100 - sum) / 100 }, ...acc.map((x) => ({ c: x.c, share: x.v / 100 }))];
  }
  const pj = parseNum(st.p);
  const lb = parseNum(st.l);
  const ls = parseNum(st.luas);
  const area = st.mode === "pl" ? (pj > 0 && lb > 0 ? pj * lb : 0) : ls > 0 ? ls : 0;
  const keliling = st.mode === "pl" && pj > 0 && lb > 0 ? 2 * (pj + lb) : 0;
  const exact = area * P.pcs * (1 + st.cad / 100);
  const total = ceilSafe(exact);
  const per = shares.map((x) => ({ ...x, pcs: ceilSafe(exact * x.share) }));
  const sumPer = per.reduce((a, b) => a + b.pcs, 0);
  const kpN = parseNum(st.kp);
  const kAuto = !(kpN > 0);
  const kLen = st.k ? (kAuto ? keliling : kpN) : 0;
  const kPcs = kLen > 0 ? ceilSafe((kLen * 100) / st.ks) : 0;
  return {
    P,
    m,
    auto,
    shares,
    manualErr,
    pj,
    lb,
    area,
    keliling,
    exact,
    total,
    per,
    sumPer,
    kanstin: { on: st.k, size: st.ks, len: kLen, auto: kAuto, pcs: kPcs },
    abuM3: st.abu ? area * 0.05 : 0,
    bcM3: st.bc ? area * 0.2 : 0,
  };
}

export type Result = ReturnType<typeof compute>;

/** Baris rincian yang sama untuk WhatsApp, salinan, dan cetak. */
export function detailLines(st: CalcState, r: Result): string[] {
  const { P, m } = r;
  const has = r.area > 0;
  const lines = [
    `• Produk: ${P.name} ${P.size}, tebal ${st.tebal} cm`,
    `• Motif: ${m.name}`,
    `• Warna${st.manual && !r.manualErr && r.shares.length > 1 ? " (persentase manual)" : ""}:`,
  ];
  for (const x of r.per) lines.push(`   – ${COLORS[x.c].name} (${fmtPct(x.share)})${has ? `: ${fmt(x.pcs)} pcs` : ""}`);
  if (!has) lines.push("• Ukuran area: belum diisi");
  else if (st.mode === "pl") lines.push(`• Ukuran area: ${fmt(r.pj)} × ${fmt(r.lb)} m = ${fmt(r.area)} m²`);
  else lines.push(`• Luas area: ${fmt(r.area)} m²`);
  lines.push(`• Cadangan: ${st.cad}%`);
  if (has) lines.push(`• Total paving: ${fmt(r.total)} pcs (${fmt(P.pcs)} pcs/m²)`);
  if (st.k) {
    if (r.kanstin.len > 0)
      lines.push(`• Kanstin ${st.ks} cm: ${fmt(r.kanstin.pcs)} pcs (${r.kanstin.auto ? "keliling " : "panjang "}${fmt(r.kanstin.len)} m)`);
    else lines.push(`• Kanstin ${st.ks} cm: panjang belum diisi`);
  }
  if (st.abu) lines.push(`• Abu batu 5 cm: ${has ? `${fmt(r.abuM3)} m³` : "menyesuaikan luas"}`);
  if (st.bc) lines.push(`• Base course 20 cm: ${has ? `${fmt(r.bcM3)} m³` : "menyesuaikan luas"}`);
  return lines;
}

export function waMessage(lines: string[], link: string) {
  return [
    "Halo Istana Block, saya mau minta penawaran paving sesuai hasil Kalkulator Pola Paving:",
    "",
    ...lines,
    "",
    "Lokasi kirim: ...",
    ...(link ? ["", `Lihat pola: ${link}`] : []),
  ].join("\n");
}

export function copyMessage(lines: string[], link: string) {
  return [
    "Rincian Kalkulator Pola Paving – Istana Block Purwakarta",
    "",
    ...lines,
    ...(link ? ["", `Tautan: ${link}`] : []),
  ].join("\n");
}
