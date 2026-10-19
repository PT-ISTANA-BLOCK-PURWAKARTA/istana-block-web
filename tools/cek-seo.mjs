#!/usr/bin/env node
// Pagar regresi SEO (KOMP-01): kesalahan yang menjatuhkan situs kompetitor ditangkap mesin, bukan mata.
//
//   node tools/cek-seo.mjs <baseUrl> [--json] [--skip-ttfb] [--prod-host istanablockpurwakarta.com]
//   npm run cek:seo -- https://istana-block-web.abdussalimsan.workers.dev
//
// Hanya modul bawaan Node >= 22 (fetch, http/https, zlib); tanpa npm install. Semua pemeriksaan membaca
// HTML mentah (tanpa menjalankan JS), seperti Googlebot tahap pertama. Exit code 1 bila ada GAGAL.
//
// Mode host: sitemap selalu memuat <loc> berdomain SITE_URL (produksi) walau dibaca dari staging atau
// localhost, jadi origin ditulis ulang ke baseUrl saat mengambil halaman dan canonical dibandingkan lewat
// path. Host selain --prod-host (dan www.-nya) memang dikirimi noindex (src/middleware.ts, src/app/robots.ts):
// itu LULUS di sana, GAGAL di produksi. Pengalihan http dan www hanya diperiksa di produksi.

import http from "node:http";
import https from "node:https";
import zlib from "node:zlib";
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Konstanta
// ---------------------------------------------------------------------------

export const PROD_HOST_BAWAAN = "istanablockpurwakarta.com";
const UA = "cek-seo/1.0 (pagar regresi istana-block-web)";
const TIMEOUT_MS = 20_000;
// Staging berjalan di Workers paket Free (batas CPU 10 ms): jangan menyerbunya.
const KONKUREN = 3;

export const BATAS = { judulMaks: 65, deskripsiMin: 70, deskripsiMaks: 165, kataMin: 150 };
// Halaman yang wajar bertubuh tipis (formulir/galeri foto, daftar artikel yang isinya tumbuh bersama artikel): kurang dari kataMin hanya PERINGATAN.
const HALAMAN_TIPIS = new Set(["/kontak", "/galeri", "/artikel"]);

const JALUR_CADANGAN = ["/", "/produk/paving-block", "/pola-paving", "/kontak"];
const PRODUK_BAWAAN = "/produk/paving-block";
// Batas usulan = baseline bundel build 19 Okt + ~25% (bukan standar). 1 KB = 1000 B, gzip level 9.
const ANGGARAN_JS = [
  { path: "/", batasKB: 140 },
  { path: PRODUK_BAWAAN, batasKB: 135 },
  { path: "/pola-paving", batasKB: 150 },
];
const TOLERANSI_JS = 1.2; // di atas batas = PERINGATAN, di atas batas x 1,2 = GAGAL
const JUMLAH_UJI_5XX = 30;
const JUMLAH_TTFB = 5;
const TTFB_PERINGATAN_MS = 800; // ambang "baik" TTFB menurut web.dev; hanya PERINGATAN

// Sitemap bersih: tidak boleh memuat jalur toko/akun WordPress atau arsip tipis.
const JALUR_TERLARANG = /^\/(?:cart|checkout|my-account|sample-page|tag|category)(?:\/|$)/i;

const POLA_PLACEHOLDER = [
  { nama: "XXXX", re: /\bX{4,}\b/ },
  { nama: "example.com", re: /(?:^|[^a-z0-9-])example\.(?:com|org|net)/i },
  { nama: "email.com", re: /(?:^|[^a-z0-9])email\.com/i },
  { nama: "kode_verifikasi", re: /kode_verifikasi/i },
  { nama: "lorem ipsum", re: /lorem ipsum/i },
];

// Teks cangkang CSR: "Loading...", "Memuat data...", atau kata tunggal "Loading"/"Memuat". Kalimat biasa
// ("Truk memuat 2 ton") sengaja tidak cocok: wajib berakhir elipsis atau berdiri sendiri.
const POLA_MEMUAT = /^(?:loading|memuat)$|^(?:loading|memuat)(?:\s+\p{L}+){0,3}\s*(?:\.{2,}|\u2026)$/iu;
const TIPE_LOKAL = new Set(["LocalBusiness", "HomeAndConstructionBusiness"]);
const TIPE_APLIKASI = new Set(["WebApplication", "SoftwareApplication", "MobileApplication"]);

const ELEMEN_VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const ELEMEN_MENTAH = new Set(["script", "style", "textarea", "title"]); // isinya teks mentah, bukan markup
const ELEMEN_LEWATI = new Set(["script", "style", "noscript", "template"]); // bukan teks yang dilihat pengunjung
const RE_SEGMEN_NEXT = /^S:\d+$/; // <div hidden id="S:1">: segmen streaming Next yang dibuka skrip, bukan sembunyi sungguhan

// ---------------------------------------------------------------------------
// Parser HTML ringan (cukup untuk HTML hasil render server; bukan parser HTML5 penuh)
// ---------------------------------------------------------------------------

const ENTITAS = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function dekodeEntitas(s) {
  return s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (cocok, des, hex, nama) => {
    if (nama) return ENTITAS[nama.toLowerCase()] ?? cocok;
    try {
      return String.fromCodePoint(des ? Number(des) : parseInt(hex, 16));
    } catch {
      return cocok;
    }
  });
}

const rapikan = (s) => s.replace(/\s+/g, " ").trim();

/** Jumlah kata: potongan yang dipisah spasi dan memuat minimal satu huruf/angka. */
export function hitungKata(teks) {
  return teks.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

const RE_TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/y;
const RE_ATTR = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function parseAttr(teks) {
  const attrs = Object.create(null);
  for (const m of teks.matchAll(RE_ATTR)) {
    const nama = m[1].toLowerCase();
    if (nama in attrs) continue; // atribut ganda: yang pertama berlaku, seperti browser
    attrs[nama] = dekodeEntitas(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return attrs;
}

/** Pecah HTML jadi token: teks, buka (nama+attrs), tutup, dan mentah (isi script/style/title). */
export function* token(html) {
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      yield { jenis: "teks", teks: html.slice(i) };
      return;
    }
    if (lt > i) yield { jenis: "teks", teks: html.slice(i, lt) };
    if (html.startsWith("<!--", lt)) {
      const akhir = html.indexOf("-->", lt + 4);
      i = akhir === -1 ? html.length : akhir + 3;
      continue;
    }
    RE_TAG.lastIndex = lt;
    const m = RE_TAG.exec(html);
    if (!m) {
      // Bukan tag: "<!doctype ...>", "<?xml ...?>" dilewati; selain itu "<" dianggap teks biasa.
      const akhir = html.startsWith("<!", lt) || html.startsWith("<?", lt) ? html.indexOf(">", lt) : -1;
      if (akhir !== -1) {
        i = akhir + 1;
      } else {
        yield { jenis: "teks", teks: "<" };
        i = lt + 1;
      }
      continue;
    }
    const [semua, tutup, namaAsli, sisa] = m;
    const nama = namaAsli.toLowerCase();
    i = lt + semua.length;
    if (tutup) {
      yield { jenis: "tutup", nama };
      continue;
    }
    const attrs = parseAttr(sisa);
    const mandiri = sisa.trimEnd().endsWith("/");
    yield { jenis: "buka", nama, attrs, mandiri };
    if (ELEMEN_MENTAH.has(nama) && !mandiri) {
      const penutup = new RegExp(`</${nama}\\s*>`, "ig");
      penutup.lastIndex = i;
      const t = penutup.exec(html);
      const akhirIsi = t ? t.index : html.length;
      if (akhirIsi > i) yield { jenis: "mentah", nama, attrs, teks: html.slice(i, akhirIsi) };
      yield { jenis: "tutup", nama };
      i = t ? t.index + t[0].length : html.length;
    }
  }
}

const sembunyiLangsung = (attrs) =>
  attrs.hidden !== undefined || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(attrs.style ?? "");

/**
 * Ambil fakta SEO dari HTML mentah satu halaman. Murni: tidak ada jaringan.
 * Teks "terlihat" = di luar script/style/noscript/template.
 */
export function ekstrakFakta(html) {
  const f = {
    lang: "",
    judul: null,
    deskripsi: null,
    canonical: [],
    robotsMeta: [],
    ogImage: null,
    adaMain: false,
    h1: [], // { teks, tersembunyi }
    teksMain: "",
    memuat: [], // node teks bergaya cangkang "Loading..."
    bailout: html.includes("BAILOUT_TO_CLIENT_SIDE_RENDERING"), // Next menaruhnya di atribut <template data-dgst>
    blokLd: [], // isi mentah <script type="application/ld+json">
    imgTanpaAlt: [],
    tautan: [], // nilai href semua <a>
    skrip: [], // { src, noModule }
    urlAttr: [], // nilai src/srcset/href: bahan mencari contoh aset /img/ dan /_next/static/
    korpus: "", // teks terlihat + atribut + JSON-LD: bahan regex placeholder
  };
  const tumpukan = []; // elemen terbuka: { nama, attrs, sembunyi }
  const korpus = [];
  const teksMain = [];
  let h1Aktif = null;

  for (const t of token(html)) {
    if (t.jenis === "buka") {
      const { nama, attrs } = t;
      if (nama === "html" && !f.lang) f.lang = attrs.lang ?? "";
      if (nama === "main") f.adaMain = true;
      if (nama === "meta") catatMeta(f, attrs);
      if (nama === "link" && /(?:^|\s)canonical(?:\s|$)/i.test(attrs.rel ?? "") && attrs.href) f.canonical.push(attrs.href);
      if (nama === "a" && attrs.href) f.tautan.push(attrs.href);
      if (nama === "img" && attrs.alt === undefined) f.imgTanpaAlt.push(attrs.src ?? "(tanpa src)");
      if (nama === "script" && attrs.src) f.skrip.push({ src: attrs.src, noModule: attrs.nomodule !== undefined });
      for (const k of ["src", "srcset", "href", "imagesrcset"]) if (attrs[k]) f.urlAttr.push(attrs[k]);
      for (const [k, v] of Object.entries(attrs)) if (v && k !== "placeholder" && !/^data:/i.test(v)) korpus.push(v);

      const sembunyi = sembunyiLangsung(attrs) && !RE_SEGMEN_NEXT.test(attrs.id ?? "");
      if (nama === "h1") {
        h1Aktif = { teks: "", tersembunyi: sembunyi || tumpukan.some((e) => e.sembunyi) };
        f.h1.push(h1Aktif);
      }
      if (!ELEMEN_VOID.has(nama) && !t.mandiri) tumpukan.push({ nama, attrs, sembunyi });
    } else if (t.jenis === "tutup") {
      let i = tumpukan.length - 1;
      while (i >= 0 && tumpukan[i].nama !== t.nama) i--;
      if (i >= 0) tumpukan.length = i; // buang elemen itu beserta anak yang tidak sempat ditutup
      if (t.nama === "h1") h1Aktif = null;
    } else if (t.jenis === "mentah") {
      if (t.nama === "script" && /ld\+json/i.test(t.attrs.type ?? "")) {
        f.blokLd.push(t.teks);
        korpus.push(t.teks);
      } else if (t.nama === "title" && f.judul === null && !tumpukan.some((e) => e.nama === "svg")) {
        f.judul = rapikan(dekodeEntitas(t.teks));
      }
    } else {
      const teks = dekodeEntitas(t.teks);
      if (!teks.trim() || tumpukan.some((e) => ELEMEN_LEWATI.has(e.nama))) continue;
      const rapi = rapikan(teks);
      korpus.push(teks);
      if (POLA_MEMUAT.test(rapi)) f.memuat.push(rapi);
      if (h1Aktif) h1Aktif.teks += ` ${rapi}`;
      if (tumpukan.some((e) => e.nama === "main")) teksMain.push(rapi);
    }
  }
  for (const h of f.h1) h.teks = rapikan(h.teks);
  f.teksMain = teksMain.join(" ");
  f.korpus = korpus.join("\n");
  return f;
}

function catatMeta(f, attrs) {
  const nama = (attrs.name ?? attrs.property ?? "").toLowerCase();
  const isi = attrs.content ?? "";
  if (nama === "description" && f.deskripsi === null) f.deskripsi = rapikan(isi);
  else if (nama === "robots" || nama === "googlebot") f.robotsMeta.push(isi);
  else if (nama === "og:image" && !f.ogImage && isi.trim()) {
    f.ogImage = isi.trim();
    f.urlAttr.push(isi);
  }
}

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

function* telusuri(nilai) {
  if (Array.isArray(nilai)) {
    for (const x of nilai) yield* telusuri(x);
  } else if (nilai && typeof nilai === "object") {
    yield nilai;
    for (const v of Object.values(nilai)) yield* telusuri(v);
  }
}

const tipeSimpul = (n) => [].concat(n["@type"] ?? []).map(String);
const nolKah = (v) => v !== undefined && v !== null && String(v).trim() !== "" && Number(v) === 0;

/** Parse tiap blok JSON-LD lalu hitung hal-hal yang tidak jujur atau ganda. */
export function analisisJsonLd(blok) {
  const hasil = { galatParse: [], offerNol: 0, adaAggregateRating: false, jumlahLokal: 0 };
  blok.forEach((mentah, i) => {
    let data;
    try {
      data = JSON.parse(mentah);
    } catch (e) {
      hasil.galatParse.push(`blok ${i + 1}: ${e.message}`);
      return;
    }
    // Offer price 0 yang sah: aplikasi/alat web yang memang gratis (isAccessibleForFree), mis. kalkulator.
    const gratisSah = new Set();
    for (const n of telusuri(data)) {
      if (n.isAccessibleForFree === true && tipeSimpul(n).some((x) => TIPE_APLIKASI.has(x))) {
        for (const o of [].concat(n.offers ?? [])) gratisSah.add(o);
      }
    }
    for (const n of telusuri(data)) {
      const tipe = tipeSimpul(n);
      if (tipe.some((x) => TIPE_LOKAL.has(x))) hasil.jumlahLokal++;
      if (tipe.includes("AggregateRating") || n.aggregateRating !== undefined) hasil.adaAggregateRating = true;
      if (!gratisSah.has(n) && tipe.some((x) => x === "Offer" || x === "AggregateOffer") && ["price", "lowPrice", "highPrice"].some((k) => nolKah(n[k]))) {
        hasil.offerNol++;
      }
    }
  });
  return hasil;
}

// ---------------------------------------------------------------------------
// Hasil + mode host
// ---------------------------------------------------------------------------

const buat = (status, cek, url, pesan, data) => ({ status, cek, url, pesan, ...(data ? { data } : {}) });
const tampilUrl = (url) => {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
};
const normalisasiPath = (p) => {
  let s = p;
  try {
    s = decodeURI(p);
  } catch {
    /* biarkan mentah */
  }
  return s.length > 1 ? s.replace(/\/+$/, "") : s;
};

export function tentukanMode(hostname, prodHost) {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  const p = prodHost.toLowerCase();
  return h === p || h === `www.${p}` ? "produksi" : "non-produksi";
}

export const esLokal = (hostname) => /^(?:localhost|127\.0\.0\.1|\[::1\])$|\.localhost$/i.test(hostname);

// ---------------------------------------------------------------------------
// Pemeriksaan satu halaman (murni)
// ---------------------------------------------------------------------------

/**
 * Jalankan semua pemeriksaan per-halaman pada fakta hasil ekstrakFakta.
 * opsi: { mode: "produksi" | "non-produksi", lokal, prodHost, xRobotsTag }
 */
export function periksaFakta(f, url, opsi = {}) {
  const o = { mode: "produksi", lokal: false, prodHost: PROD_HOST_BAWAAN, xRobotsTag: "", ...opsi };
  const path = new URL(url).pathname;
  const hasil = [];
  const tambah = (status, cek, pesan, data) => hasil.push(buat(status, cek, url, pesan, data));
  // Di localhost SITE_URL sering kosong dan tidak ada Cloudflare di depan: kekurangan itu cukup PERINGATAN.
  const keparahan = o.lokal ? "PERINGATAN" : "GAGAL";

  // noindex: kebalikan menurut mode host
  const noindex = /noindex/i.test(o.xRobotsTag) || f.robotsMeta.some((m) => /noindex/i.test(m));
  if (o.mode === "produksi") {
    if (noindex) tambah("GAGAL", "noindex", `halaman produksi ber-noindex (x-robots-tag: "${o.xRobotsTag}", meta robots: "${f.robotsMeta.join(" | ")}")`);
    else tambah("LULUS", "noindex", "tidak ada noindex");
  } else if (noindex) {
    tambah("LULUS", "noindex", "noindex terkirim (benar untuk host non-produksi)");
  } else {
    tambah(keparahan, "noindex", "host non-produksi tanpa noindex: salinan situs bisa masuk indeks Google (cek SITE_URL, src/middleware.ts)");
  }

  // satu h1 yang terlihat dan berisi
  const terlihat = f.h1.filter((h) => !h.tersembunyi && h.teks);
  if (f.h1.length === 0) tambah("GAGAL", "h1", "tidak ada <h1> di HTML mentah");
  else if (f.h1.length > 1) tambah("GAGAL", "h1", `${f.h1.length} elemen <h1> (${terlihat.length} terlihat dan berisi); harus tepat satu`);
  else if (f.h1[0].tersembunyi) tambah("GAGAL", "h1", `<h1> tersembunyi (display:none/hidden): "${f.h1[0].teks.slice(0, 60)}"`);
  else if (!f.h1[0].teks) tambah("GAGAL", "h1", "<h1> kosong");
  else tambah("LULUS", "h1", `"${f.h1[0].teks.slice(0, 70)}"`);

  const lang = f.lang.toLowerCase().split("-")[0];
  if (lang === "id") tambah("LULUS", "lang", `lang="${f.lang}"`);
  else tambah("GAGAL", "lang", f.lang ? `lang="${f.lang}", seharusnya "id"` : '<html> tanpa atribut lang (seharusnya "id")');

  if (!f.judul) tambah("GAGAL", "title", "tidak ada <title> atau kosong");
  else if (f.judul.length > BATAS.judulMaks) tambah("GAGAL", "title", `${f.judul.length} karakter (maks ${BATAS.judulMaks}): "${f.judul}"`);
  else tambah("LULUS", "title", `${f.judul.length} karakter: "${f.judul}"`);

  if (!f.deskripsi) tambah("GAGAL", "description", "tidak ada meta description");
  else if (f.deskripsi.length < BATAS.deskripsiMin || f.deskripsi.length > BATAS.deskripsiMaks) {
    tambah("GAGAL", "description", `${f.deskripsi.length} karakter (harus ${BATAS.deskripsiMin}-${BATAS.deskripsiMaks})`);
  } else tambah("LULUS", "description", `${f.deskripsi.length} karakter`);

  periksaCanonical(f, url, path, o, tambah);

  // isi utama sudah ada di HTML mentah (bukan cangkang CSR)
  const kata = hitungKata(f.teksMain);
  if (!f.adaMain) tambah("GAGAL", "isi", "tidak ada elemen <main> di HTML mentah");
  else if (kata < BATAS.kataMin) {
    tambah(HALAMAN_TIPIS.has(normalisasiPath(path)) ? "PERINGATAN" : "GAGAL", "isi", `${kata} kata di <main> (minimal ${BATAS.kataMin})`, { kata });
  } else tambah("LULUS", "isi", `${kata} kata di <main>`, { kata });

  if (f.bailout || f.memuat.length) {
    const sebab = [f.bailout ? "BAILOUT_TO_CLIENT_SIDE_RENDERING" : "", ...f.memuat.slice(0, 3).map((x) => `"${x}"`)].filter(Boolean);
    tambah("GAGAL", "csr", `isi dirender di klien (cangkang): ${sebab.join(", ")}`);
  } else tambah("LULUS", "csr", 'tanpa teks "Loading"/"Memuat" dan tanpa BAILOUT_TO_CLIENT_SIDE_RENDERING');

  // JSON-LD
  const ld = analisisJsonLd(f.blokLd);
  if (ld.galatParse.length) tambah("GAGAL", "jsonld", `JSON-LD rusak: ${ld.galatParse.join("; ")}`);
  else tambah("LULUS", "jsonld", `${f.blokLd.length} blok JSON-LD terparse`);
  const klaim = [ld.offerNol ? `${ld.offerNol} Offer dengan price 0` : "", ld.adaAggregateRating ? "AggregateRating" : ""].filter(Boolean);
  if (klaim.length) tambah("GAGAL", "jsonld-klaim", `data terstruktur tidak jujur: ${klaim.join(", ")}`);
  else tambah("LULUS", "jsonld-klaim", "tanpa Offer price 0 dan tanpa AggregateRating");
  if (ld.jumlahLokal === 1) tambah("LULUS", "jsonld-lokal", "tepat satu node LocalBusiness");
  else tambah("GAGAL", "jsonld-lokal", ld.jumlahLokal ? `${ld.jumlahLokal} node LocalBusiness (harus tepat satu)` : "tidak ada node LocalBusiness/HomeAndConstructionBusiness");

  const placeholder = POLA_PLACEHOLDER.filter((p) => p.re.test(f.korpus)).map((p) => p.nama);
  if (placeholder.length) tambah("GAGAL", "placeholder", `teks cadangan masih ada: ${placeholder.join(", ")}`);
  else tambah("LULUS", "placeholder", "tanpa teks cadangan (XXXX, example.com, email.com, kode_verifikasi, lorem ipsum)");

  if (f.ogImage) tambah("LULUS", "og-image", f.ogImage);
  else tambah("GAGAL", "og-image", "tidak ada meta og:image");

  if (f.imgTanpaAlt.length) tambah("GAGAL", "img-alt", `${f.imgTanpaAlt.length} <img> tanpa atribut alt, mis. ${f.imgTanpaAlt.slice(0, 2).join(", ")}`);
  else tambah("LULUS", "img-alt", "semua <img> punya alt");

  return hasil;
}

function periksaCanonical(f, url, path, o, tambah) {
  if (f.canonical.length === 0) return tambah("GAGAL", "canonical", "tidak ada <link rel=canonical>");
  let urlCanonical;
  try {
    urlCanonical = f.canonical.map((c) => new URL(c, url));
  } catch {
    return tambah("GAGAL", "canonical", `canonical tidak valid: ${f.canonical.join(" | ")}`);
  }
  if (new Set(urlCanonical.map((u) => u.href)).size > 1) return tambah("GAGAL", "canonical", `${f.canonical.length} canonical berbeda: ${f.canonical.join(" | ")}`);
  const c = urlCanonical[0];
  // Path, bukan origin: canonical memakai SITE_URL (produksi) walau halaman dibaca dari staging.
  if (normalisasiPath(c.pathname) !== normalisasiPath(path)) return tambah("GAGAL", "canonical", `path canonical ${c.pathname} tidak sama dengan path halaman ${path}`);
  const tanpaWww = (h) => h.toLowerCase().replace(/^www\./, "");
  if (o.mode === "produksi" && tanpaWww(c.hostname) !== tanpaWww(o.prodHost)) {
    return tambah("GAGAL", "canonical", `canonical menunjuk host ${c.hostname}, bukan ${o.prodHost}`);
  }
  tambah("LULUS", "canonical", c.href);
}

/** Judul harus unik antar halaman. daftar: [{ url, judul }] */
export function periksaJudulUnik(daftar) {
  const peta = new Map();
  for (const d of daftar) {
    if (!d.judul) continue;
    const kunci = d.judul.toLowerCase();
    peta.set(kunci, [...(peta.get(kunci) ?? []), d.url]);
  }
  return daftar
    .filter((d) => d.judul)
    .map((d) => {
      const kembar = peta.get(d.judul.toLowerCase());
      return kembar.length > 1
        ? buat("GAGAL", "title-unik", d.url, `judul sama dengan ${kembar.filter((u) => u !== d.url).map(tampilUrl).join(", ")}`)
        : buat("LULUS", "title-unik", d.url, "judul unik");
    });
}

/** Analisis lengkap satu halaman dari HTML mentah: { fakta, hasil }. */
export function analisisHtml(html, url, opsi = {}) {
  const fakta = ekstrakFakta(html);
  return { fakta, hasil: periksaFakta(fakta, url, opsi) };
}

// ---------------------------------------------------------------------------
// Sitemap + header + robots (murni)
// ---------------------------------------------------------------------------

const ambilTag = (blok, tag) => {
  const m = blok.match(new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*</${tag}>`, "i"));
  return m ? dekodeEntitas(m[1]) : null;
};

export function parseSitemap(xml) {
  const entri = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)]
    .map((m) => ({ loc: ambilTag(m[1], "loc"), lastmod: ambilTag(m[1], "lastmod") }))
    .filter((e) => e.loc);
  return { adaUrlset: /<urlset[\s>]/i.test(xml), adaIndeks: /<sitemapindex[\s>]/i.test(xml), entri };
}

/** Pemeriksaan isi sitemap. opsi: { mode, prodHost, sekarang } */
export function periksaSitemap(entri, opsi = {}) {
  const o = { mode: "produksi", prodHost: PROD_HOST_BAWAAN, sekarang: Date.now(), url: "/sitemap.xml", ...opsi };
  const hasil = [];
  const url = o.url;
  const tambah = (status, cek, pesan) => hasil.push(buat(status, cek, url, pesan));

  tambah(entri.length ? "LULUS" : "GAGAL", "sitemap-jumlah", `${entri.length} URL`);

  const terlarang = entri.filter((e) => JALUR_TERLARANG.test(safePath(e.loc)));
  if (terlarang.length) tambah("GAGAL", "sitemap-bersih", `memuat jalur yang tidak boleh diindeks: ${terlarang.slice(0, 5).map((e) => safePath(e.loc)).join(", ")}`);
  else tambah("LULUS", "sitemap-bersih", "tanpa /cart, /checkout, /my-account, /tag/, /category/");

  const nilai = entri.map((e) => e.lastmod).filter(Boolean);
  const unik = new Set(nilai);
  if (nilai.length < 2) tambah("LULUS", "sitemap-lastmod", `lastmod ada di ${nilai.length} URL; belum bisa dibandingkan`);
  else if (unik.size > 1) tambah("LULUS", "sitemap-lastmod", `${unik.size} nilai lastmod berbeda di ${nilai.length} URL`);
  else {
    const ms = Date.parse([...unik][0]);
    // Sitemap kompetitor mengisi lastmod dengan waktu permintaan: pola itu yang ditangkap sebagai GAGAL.
    if (Number.isFinite(ms) && Math.abs(o.sekarang - ms) < 15 * 60_000) {
      tambah("GAGAL", "sitemap-lastmod", `semua ${nilai.length} lastmod sama dengan waktu permintaan (${[...unik][0]})`);
    } else tambah("PERINGATAN", "sitemap-lastmod", `semua ${nilai.length} lastmod identik (${[...unik][0]}): kemungkinan tanggal impor, bukan tanggal ubah nyata`);
  }

  if (o.mode === "produksi") {
    const tanpaWww = (h) => h.toLowerCase().replace(/^www\./, "");
    const asing = entri.filter((e) => {
      try {
        return tanpaWww(new URL(e.loc).hostname) !== tanpaWww(o.prodHost);
      } catch {
        return true;
      }
    });
    if (asing.length) tambah("GAGAL", "sitemap-host", `${asing.length} <loc> bukan berdomain ${o.prodHost}, mis. ${asing[0].loc}`);
    else tambah("LULUS", "sitemap-host", `semua <loc> berdomain ${o.prodHost}`);
  }
  return hasil;
}

function safePath(loc) {
  try {
    return new URL(loc).pathname;
  } catch {
    return loc;
  }
}

/**
 * Tepat satu Cache-Control, tidak saling meniadakan. nilai: daftar nilai header (satu entri per baris
 * header mentah). jenis: "html" | "static" | "img".
 */
export function periksaCacheControl(nilai, jenis) {
  if (nilai.length === 0) return { status: "GAGAL", pesan: "tidak ada header Cache-Control" };
  if (nilai.length > 1) return { status: "GAGAL", pesan: `${nilai.length} header Cache-Control: ${nilai.map((v) => `"${v}"`).join(" + ")}` };
  const v = nilai[0].toLowerCase();
  // Cadangan bila proxy menggabungkan baris ganda jadi satu nilai bergaya "a, b, c".
  const jumlahMaxAge = (v.match(/(?<![\w-])max-age=\d+/g) ?? []).length;
  const maxAgePositif = [...v.matchAll(/(?<![\w-])(?:max-age|s-maxage)=(\d+)/g)].some((m) => Number(m[1]) > 0);
  if (jumlahMaxAge > 1) return { status: "GAGAL", pesan: `arahan max-age muncul ${jumlahMaxAge}x (diduga header ganda yang digabung): "${nilai[0]}"` };
  if (/\bno-store\b/.test(v) && (/\bimmutable\b/.test(v) || /\bpublic\b/.test(v) || maxAgePositif)) {
    return { status: "GAGAL", pesan: `arahan saling meniadakan (no-store bersama public/immutable/max-age>0): "${nilai[0]}"` };
  }
  if (jenis === "static" && !/\bimmutable\b/.test(v)) return { status: "PERINGATAN", pesan: `satu header, tetapi tanpa immutable: "${nilai[0]}"` };
  return { status: "LULUS", pesan: `"${nilai[0]}"` };
}

// Pustaka ikon/UI/slider yang menggembungkan bundel kompetitor (mis. Font Awesome 626 KB gz di Conbloc).
// Daftar pola, bukan baseline: menambah pustaka serupa ke `dependencies` harus lewat tinjauan anggaran JS.
const PUSTAKA_BERAT =
  /^(?:@fortawesome\/.+|font-?awesome|react-icons|lucide(?:-react)?|@heroicons\/.+|bootstrap|react-bootstrap|animate\.css|owl\.carousel|swiper|slick-carousel|react-slick|embla-carousel.*|keen-slider|glide.*|@mui\/.+|antd|@chakra-ui\/.+|jquery)$/i;

/** package.json: tidak ada pustaka ikon/UI/slider berat di `dependencies` (devDependencies tidak masuk bundel). */
export function periksaDependensi(pkg) {
  const kena = Object.keys(pkg?.dependencies ?? {}).filter((n) => PUSTAKA_BERAT.test(n));
  return kena.length
    ? buat("GAGAL", "dependensi", "package.json", `pustaka ikon/UI/slider ditambahkan: ${kena.join(", ")}; periksa anggaran JS lalu ubah daftar PUSTAKA_BERAT bila disengaja`)
    : buat("LULUS", "dependensi", "package.json", "tanpa pustaka ikon/UI/slider berat di dependencies");
}

/** Path internal (path + query, tanpa #hash) dari daftar href. hostInternal: hostname yang dianggap situs ini. */
export function tautanInternal(tautan, urlHalaman, hostInternal) {
  const tanpaWww = (h) => h.toLowerCase().replace(/^www\./, "");
  const hasil = new Set();
  for (const href of tautan) {
    let u;
    try {
      u = new URL(href, urlHalaman);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol)) continue; // mailto:, tel:, javascript:
    if (!hostInternal.some((h) => tanpaWww(h) === tanpaWww(u.hostname))) continue;
    hasil.add(u.pathname + u.search);
  }
  return [...hasil];
}

/** robots.txt: apakah grup User-agent * menutup seluruh situs (Disallow: /)? */
export function robotsBlokirSemua(teks) {
  let grupBintang = false;
  let barisUA = false;
  for (const mentah of teks.split(/\r?\n/)) {
    const baris = mentah.replace(/#.*$/, "").trim();
    const m = baris.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const kunci = m[1].toLowerCase();
    if (kunci === "user-agent") {
      if (!barisUA) grupBintang = false; // User-agent berurutan satu grup; yang baru memulai grup baru
      barisUA = true;
      if (m[2].trim() === "*") grupBintang = true;
    } else {
      barisUA = false;
      if (kunci === "disallow" && grupBintang && m[2].trim() === "/") return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Jaringan
// ---------------------------------------------------------------------------

const galatSingkat = (e) => (e?.name === "TimeoutError" ? "timeout" : (e?.cause?.code ?? e?.cause?.message ?? e?.message ?? String(e)));

/** GET tanpa mengikuti redirect. Tidak pernah melempar: galat jaringan masuk ke field `galat`. */
async function ambilHalaman(url, headers = {}, { baca = true } = {}) {
  const mulai = performance.now();
  try {
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "user-agent": UA, accept: "text/html,*/*", "accept-language": "id", ...headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const ms = performance.now() - mulai; // fetch selesai saat header tiba: pendekatan TTFB
    let html = "";
    if (res.status === 200 && baca) html = await res.text();
    else await res.body?.cancel().catch(() => {});
    return { url, status: res.status, headers: res.headers, location: res.headers.get("location"), html, ms };
  } catch (e) {
    return { url, status: 0, headers: new Headers(), location: null, html: "", ms: performance.now() - mulai, galat: galatSingkat(e) };
  }
}

/** Header mentah apa adanya (satu entri per baris), karena fetch menggabungkan baris ganda jadi satu. */
function ambilHeaderMentah(url, headers = {}) {
  return new Promise((selesai, gagal) => {
    const u = new URL(url);
    const modul = u.protocol === "http:" ? http : https;
    const req = modul.request(u, { method: "GET", headers: { "user-agent": UA, ...headers }, timeout: TIMEOUT_MS }, (res) => {
      res.on("error", () => {});
      const peta = new Map();
      for (let i = 0; i < res.rawHeaders.length; i += 2) {
        const k = res.rawHeaders[i].toLowerCase();
        peta.set(k, [...(peta.get(k) ?? []), res.rawHeaders[i + 1]]);
      }
      selesai({ status: res.statusCode ?? 0, header: peta });
      res.destroy(); // cukup header; isi tidak dibaca
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (e) => gagal(e));
    req.end();
  });
}

async function paralel(daftar, batas, fn) {
  const hasil = new Array(daftar.length);
  let berikut = 0;
  const pekerja = Array.from({ length: Math.min(batas, daftar.length) }, async () => {
    while (berikut < daftar.length) {
      const i = berikut++;
      hasil[i] = await fn(daftar[i], i);
    }
  });
  await Promise.all(pekerja);
  return hasil;
}

const median = (angka) => {
  const s = [...angka].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ---------------------------------------------------------------------------
// Pemeriksaan yang butuh jaringan
// ---------------------------------------------------------------------------

function cariJalur(daftarFakta, pola) {
  for (const f of daftarFakta) {
    for (const nilai of f.urlAttr) {
      let teks = nilai;
      try {
        teks = decodeURIComponent(nilai); // /_next/image?url=%2Fimg%2F... -> /img/...
      } catch {
        /* pakai apa adanya */
      }
      const m = teks.match(pola);
      if (m) return m[0];
    }
  }
  return null;
}

async function periksaHeader(ctx, daftarFakta) {
  const hasil = [];
  const tambah = (status, cek, url, pesan) => hasil.push(buat(status, cek, url, pesan));
  const keparahan = ctx.lokal ? "PERINGATAN" : "GAGAL";

  const urlBeranda = `${ctx.base}/`;
  let beranda;
  try {
    beranda = await ambilHeaderMentah(urlBeranda, { accept: "text/html", "accept-encoding": "gzip, br" });
  } catch (e) {
    tambah("GAGAL", "header", urlBeranda, `tidak bisa mengambil header beranda: ${galatSingkat(e)}`);
    return hasil;
  }
  if (beranda.status !== 200) {
    tambah("GAGAL", "header", urlBeranda, `beranda membalas ${beranda.status}, header tidak bisa dinilai`);
    return hasil;
  }
  const cc = periksaCacheControl(beranda.header.get("cache-control") ?? [], "html");
  tambah(cc.status, "cache-control-html", urlBeranda, cc.pesan);

  const enc = (beranda.header.get("content-encoding") ?? []).join(",").toLowerCase();
  if (/\b(?:br|gzip|zstd)\b/.test(enc)) tambah("LULUS", "kompresi", urlBeranda, `content-encoding: ${enc}`);
  else tambah(keparahan, "kompresi", urlBeranda, `HTML tanpa kompresi walau meminta "gzip, br" (content-encoding: ${enc || "tidak ada"})`);

  const ib = beranda.header.get("x-ib-cache");
  if (ib) tambah("LULUS", "x-ib-cache", urlBeranda, `x-ib-cache: ${ib.join(",")}`);
  else tambah("PERINGATAN", "x-ib-cache", urlBeranda, "tidak ada header x-ib-cache (cache worker.ts tidak aktif di host ini; aman, tetapi tidak terukur)");

  for (const { cek, pola, jenis, label } of [
    { cek: "cache-control-static", pola: /\/_next\/static\/[^\s"',?#)]+\.js/, jenis: "static", label: "/_next/static/*.js" },
    { cek: "cache-control-img", pola: /\/img\/[^\s"',?#)]+/, jenis: "img", label: "/img/*" },
  ]) {
    const jalur = cariJalur(daftarFakta, pola);
    if (!jalur) {
      tambah("PERINGATAN", cek, ctx.base, `tidak ada berkas ${label} di HTML yang diperiksa`);
      continue;
    }
    const url = `${ctx.base}${jalur}`;
    try {
      const r = await ambilHeaderMentah(url);
      if (r.status !== 200) tambah("GAGAL", cek, url, `status ${r.status}`);
      else {
        const hasilCc = periksaCacheControl(r.header.get("cache-control") ?? [], jenis);
        tambah(hasilCc.status, cek, url, hasilCc.pesan);
      }
    } catch (e) {
      tambah("GAGAL", cek, url, `galat jaringan: ${galatSingkat(e)}`);
    }
  }
  return hasil;
}

async function periksaRobots(ctx) {
  const url = `${ctx.base}/robots.txt`;
  const r = await ambilHalaman(url, { accept: "text/plain" });
  if (r.status !== 200) return [buat("GAGAL", "robots", url, r.galat ? `galat jaringan: ${r.galat}` : `status ${r.status}`)];
  const tutup = robotsBlokirSemua(r.html);
  if (ctx.mode === "non-produksi") {
    return [
      tutup
        ? buat("LULUS", "robots", url, "Disallow: / (benar untuk host non-produksi)")
        : buat(ctx.lokal ? "PERINGATAN" : "GAGAL", "robots", url, "host non-produksi tanpa Disallow: /"),
    ];
  }
  if (tutup) return [buat("GAGAL", "robots", url, "robots.txt produksi menutup seluruh situs (Disallow: /)")];
  return [
    /^\s*sitemap\s*:\s*\S+/im.test(r.html)
      ? buat("LULUS", "robots", url, "terbuka untuk crawler dan memuat Sitemap")
      : buat("PERINGATAN", "robots", url, "terbuka, tetapi tanpa baris Sitemap:"),
  ];
}

async function periksaPengalihan(ctx) {
  const kasus = [
    { cek: "redirect-http", dari: `http://${ctx.prodHost}/`, ke: `https://${ctx.prodHost}/` },
    { cek: "redirect-www", dari: `https://www.${ctx.prodHost}/`, ke: `https://${ctx.prodHost}/` },
  ];
  return paralel(kasus, 1, async ({ cek, dari, ke }) => {
    const r = await ambilHalaman(dari, {}, { baca: false });
    if (r.galat) return buat("PERINGATAN", cek, dari, `tidak bisa dihubungi: ${r.galat}`);
    let tujuan = null;
    try {
      tujuan = r.location ? new URL(r.location, dari).href : null;
    } catch {
      /* Location rusak: ditangani di bawah */
    }
    if (r.status < 300 || r.status >= 400) return buat("GAGAL", cek, dari, `status ${r.status}, tidak dialihkan ke ${ke}`);
    if (tujuan !== ke) return buat("GAGAL", cek, dari, `${r.status} ke ${tujuan ?? "(tanpa Location)"}, harus langsung ke ${ke} (satu lompatan)`);
    if (r.status !== 301 && r.status !== 308) return buat("PERINGATAN", cek, dari, `${r.status} sementara, bukan permanen (301/308)`);
    return buat("LULUS", cek, dari, `${r.status} satu lompatan ke ${ke}`);
  });
}

/** Tautan internal di beranda (di luar yang sudah dicek lewat sitemap) harus 200: kompetitor menaut halaman 404. */
async function periksaTautanBeranda(ctx, fakta, sudahDiperiksa) {
  const urlBeranda = `${ctx.base}/`;
  if (!fakta) return [buat("PERINGATAN", "tautan-beranda", urlBeranda, "beranda tidak terbaca, tautan internal tidak diperiksa")];
  const daftar = tautanInternal(fakta.tautan, urlBeranda, [ctx.hostname, ctx.prodHost]).filter((p) => !sudahDiperiksa.has(p));
  const hasil = await paralel(daftar, KONKUREN, async (p) => ({ p, ...(await ambilHalaman(`${ctx.base}${p}`, {}, { baca: false })) }));
  const rusak = hasil.filter((r) => r.status !== 200);
  if (!rusak.length) return [buat("LULUS", "tautan-beranda", urlBeranda, `${daftar.length} tautan internal di luar sitemap, semuanya 200`)];
  return rusak.map((r) => {
    const sebab = r.galat ? `galat jaringan: ${r.galat}` : r.status >= 300 && r.status < 400 ? `redirect ${r.status} ke ${r.location ?? "?"}` : `status ${r.status}`;
    return buat(r.status >= 300 && r.status < 400 ? "PERINGATAN" : "GAGAL", "tautan-beranda", `${ctx.base}${r.p}`, `ditaut dari beranda: ${sebab}`);
  });
}

async function periksa5xx(ctx, produk) {
  const sasaran = [`${ctx.base}/`, `${ctx.base}${produk}`];
  const tally = new Map();
  let galat = 0;
  for (let i = 0; i < JUMLAH_UJI_5XX; i++) {
    const r = await ambilHalaman(sasaran[i % sasaran.length], {}, { baca: false });
    if (r.galat) galat++;
    else tally.set(r.status, (tally.get(r.status) ?? 0) + 1);
  }
  const ringkas = [...tally].map(([k, v]) => `${k}x${v}`).join(" ") + (galat ? ` galat-jaringan x${galat}` : "");
  const lima = [...tally].filter(([k]) => k >= 500).reduce((a, [, v]) => a + v, 0);
  const url = `${ctx.base}/`;
  const pesan = `${JUMLAH_UJI_5XX} permintaan beruntun ke / dan ${produk}: ${ringkas}`;
  if (lima) return buat("GAGAL", "5xx", url, `${lima} respons 5xx dari ${pesan}`);
  if (galat) return buat("PERINGATAN", "5xx", url, `${pesan}`);
  return buat("LULUS", "5xx", url, `0 respons 5xx dari ${pesan}`);
}

const cacheUkuran = new Map();
async function ukuranGzip(url) {
  if (!cacheUkuran.has(url)) {
    cacheUkuran.set(
      url,
      fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(TIMEOUT_MS) }).then(async (res) => {
        if (res.status !== 200) throw new Error(`status ${res.status}`);
        return zlib.gzipSync(Buffer.from(await res.arrayBuffer()), { level: 9 }).length;
      }),
    );
  }
  return cacheUkuran.get(url);
}

async function periksaAnggaranJs(ctx, faktaPerJalur, produk) {
  const hasil = [];
  for (const { path: jalurAsli, batasKB } of ANGGARAN_JS) {
    const jalur = jalurAsli === PRODUK_BAWAAN ? produk : jalurAsli;
    const url = `${ctx.base}${jalur}`;
    let f = faktaPerJalur.get(jalur);
    if (!f) {
      const r = await ambilHalaman(url);
      if (r.status === 200) f = ekstrakFakta(r.html);
    }
    if (!f) {
      hasil.push(buat("PERINGATAN", "anggaran-js", url, "halaman tidak bisa diambil, anggaran JS tidak dihitung"));
      continue;
    }
    // Hanya skrip satu origin dan bukan noModule: polyfill lama dan tag pihak ketiga (GTM) bukan bundel kita.
    const daftar = [];
    let pihakKetiga = 0;
    for (const s of f.skrip) {
      if (s.noModule) continue;
      let u;
      try {
        u = new URL(s.src, url);
      } catch {
        continue;
      }
      if (u.hostname.toLowerCase() === ctx.hostname) daftar.push(`${ctx.base}${u.pathname}${u.search}`);
      else pihakKetiga++;
    }
    const unik = [...new Set(daftar)];
    let total = 0;
    let gagalUnduh = null;
    for (const u of unik) {
      try {
        total += await ukuranGzip(u);
      } catch (e) {
        gagalUnduh = `${tampilUrl(u)}: ${galatSingkat(e)}`;
        break;
      }
    }
    if (gagalUnduh) {
      hasil.push(buat("PERINGATAN", "anggaran-js", url, `gagal mengunduh skrip (${gagalUnduh}); anggaran tidak dihitung`));
      continue;
    }
    const batas = batasKB * 1000;
    const pesan = `${(total / 1000).toFixed(1)} KB gz dari batas ${batasKB} KB, ${unik.length} skrip satu origin${pihakKetiga ? ` (+${pihakKetiga} pihak ketiga tidak dihitung)` : ""}`;
    const status = total > batas * TOLERANSI_JS ? "GAGAL" : total > batas ? "PERINGATAN" : "LULUS";
    hasil.push(buat(status, "anggaran-js", url, pesan, { gzipBytes: total, batasBytes: batas, jumlahSkrip: unik.length }));
  }
  return hasil;
}

async function ukurTtfb(ctx, produk) {
  const hasil = [];
  const lokasi = process.env.LOKASI_UKUR ? `lokasi ukur: ${process.env.LOKASI_UKUR}` : "lokasi ukur tidak dicatat, isi env LOKASI_UKUR";
  for (const jalur of ["/", produk, "/kontak"]) {
    const url = `${ctx.base}${jalur}`;
    const ms = [];
    const cache = new Map();
    const status = new Map();
    for (let i = 0; i < JUMLAH_TTFB; i++) {
      const r = await ambilHalaman(url, {}, { baca: false });
      if (r.galat) {
        status.set("galat", (status.get("galat") ?? 0) + 1);
        continue;
      }
      ms.push(r.ms);
      status.set(r.status, (status.get(r.status) ?? 0) + 1);
      const kunci = r.headers.get("x-ib-cache") ?? "tanpa";
      cache.set(kunci, (cache.get(kunci) ?? 0) + 1);
    }
    if (!ms.length) {
      hasil.push(buat("GAGAL", "ttfb", url, `semua ${JUMLAH_TTFB} permintaan gagal`));
      continue;
    }
    const med = median(ms);
    const tidak200 = [...status].filter(([k]) => k !== 200);
    const pesan =
      `min ${Math.min(...ms).toFixed(0)} ms, median ${med.toFixed(0)} ms, maks ${Math.max(...ms).toFixed(0)} ms (${ms.length}x); ` +
      `x-ib-cache: ${[...cache].map(([k, v]) => `${k}=${v}`).join(" ")}; ` +
      (tidak200.length ? `status bukan 200: ${tidak200.map(([k, v]) => `${k}x${v}`).join(" ")}; ` : "") +
      `angka bergantung lokasi pengukur; ${lokasi}`;
    hasil.push(buat(med > TTFB_PERINGATAN_MS || tidak200.length ? "PERINGATAN" : "LULUS", "ttfb", url, pesan, { minMs: Math.min(...ms), medianMs: med, cache: Object.fromEntries(cache) }));
  }
  return hasil;
}

// ---------------------------------------------------------------------------
// Alur utama
// ---------------------------------------------------------------------------

class GalatPakai extends Error {}

function parseArgumen(argv) {
  const o = { baseUrl: null, json: false, skipTtfb: false, prodHost: PROD_HOST_BAWAAN };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") o.json = true;
    else if (a === "--skip-ttfb") o.skipTtfb = true;
    else if (a === "--prod-host" || a.startsWith("--prod-host=")) {
      const nilai = a.includes("=") ? a.slice(a.indexOf("=") + 1) : argv[++i];
      if (!nilai) throw new GalatPakai("--prod-host butuh nilai");
      o.prodHost = nilai.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    } else if (a.startsWith("-")) throw new GalatPakai(`opsi tidak dikenal: ${a}`);
    else if (!o.baseUrl) o.baseUrl = a;
    else throw new GalatPakai(`argumen berlebih: ${a}`);
  }
  if (!o.baseUrl) throw new GalatPakai("baseUrl wajib diisi");
  return o;
}

async function jalankan(opsi) {
  let base;
  try {
    base = new URL(/^https?:\/\//i.test(opsi.baseUrl) ? opsi.baseUrl : `https://${opsi.baseUrl}`);
  } catch {
    throw new GalatPakai(`baseUrl tidak valid: ${opsi.baseUrl}`);
  }
  const hostname = base.hostname.toLowerCase();
  const ctx = {
    base: base.origin,
    hostname,
    prodHost: opsi.prodHost,
    mode: tentukanMode(hostname, opsi.prodHost),
    lokal: esLokal(hostname),
  };
  const log = (pesan) => {
    if (!opsi.json) process.stderr.write(`${pesan}\n`);
  };
  const situs = []; // pemeriksaan tingkat situs
  const perHalaman = new Map(); // url -> hasil[]

  // 1. Sitemap
  log(`Mengambil ${ctx.base}/sitemap.xml ...`);
  const urlSitemap = `${ctx.base}/sitemap.xml`;
  const sm = await ambilHalaman(urlSitemap, { accept: "application/xml,text/xml,*/*" });
  let jalur = [];
  let adaSitemap = false;
  if (sm.status !== 200) {
    situs.push(buat("GAGAL", "sitemap", urlSitemap, sm.galat ? `galat jaringan: ${sm.galat}` : `status ${sm.status}${sm.location ? ` -> ${sm.location}` : ""}`));
  } else {
    const peta = parseSitemap(sm.html);
    if (!peta.adaUrlset) {
      situs.push(buat("GAGAL", "sitemap", urlSitemap, peta.adaIndeks ? "sitemap index belum didukung skrip ini" : "bukan XML <urlset>"));
    } else {
      adaSitemap = true;
      situs.push(...periksaSitemap(peta.entri, { mode: ctx.mode, prodHost: ctx.prodHost, url: urlSitemap }));
      // Tulis ulang origin ke baseUrl (sitemap berisi domain produksi); simpan path + query.
      jalur = peta.entri.map((e) => {
        try {
          const u = new URL(e.loc);
          return u.pathname + u.search;
        } catch {
          return e.loc;
        }
      });
    }
  }
  if (!adaSitemap) {
    jalur = JALUR_CADANGAN;
    log("Sitemap tidak bisa dipakai: memeriksa jalur cadangan saja.");
  }
  const produk = jalur.find((p) => p === PRODUK_BAWAAN) ?? jalur.find((p) => p.startsWith("/produk/")) ?? PRODUK_BAWAAN;

  // 2. Tiap halaman
  log(`Memeriksa ${jalur.length} halaman ...`);
  const faktaPerJalur = new Map();
  const judul = [];
  await paralel(jalur, KONKUREN, async (p) => {
    const url = `${ctx.base}${p}`;
    const r = await ambilHalaman(url, { accept: "text/html" });
    const h = [];
    if (r.galat) h.push(buat("GAGAL", "status", url, `galat jaringan: ${r.galat}`));
    else if (r.status !== 200) h.push(buat("GAGAL", "status", url, r.status >= 300 && r.status < 400 ? `redirect ${r.status} ke ${r.location ?? "?"}` : `status ${r.status}, harus 200`));
    else {
      h.push(buat("LULUS", "status", url, "200 tanpa redirect"));
      const { fakta, hasil } = analisisHtml(r.html, url, {
        mode: ctx.mode,
        lokal: ctx.lokal,
        prodHost: ctx.prodHost,
        xRobotsTag: r.headers.get("x-robots-tag") ?? "",
      });
      h.push(...hasil);
      faktaPerJalur.set(p, fakta);
      judul.push({ url, judul: fakta.judul });
    }
    perHalaman.set(url, h);
  });
  for (const hasil of periksaJudulUnik(judul)) perHalaman.get(hasil.url)?.push(hasil);

  // 3. robots.txt, header, pengalihan, tautan, 5xx, anggaran JS, TTFB
  log("Memeriksa robots.txt dan header ...");
  situs.push(...(await periksaRobots(ctx)));
  situs.push(...(await periksaHeader(ctx, [...faktaPerJalur.values()])));
  if (ctx.mode === "produksi") {
    log("Memeriksa pengalihan http dan www ...");
    situs.push(...(await periksaPengalihan(ctx)));
  }
  log("Memeriksa tautan internal beranda ...");
  situs.push(...(await periksaTautanBeranda(ctx, faktaPerJalur.get("/"), new Set(jalur))));
  log(`Mengirim ${JUMLAH_UJI_5XX} permintaan beruntun (uji 5xx) ...`);
  situs.push(await periksa5xx(ctx, produk));
  log("Menghitung anggaran JS ...");
  situs.push(...(await periksaAnggaranJs(ctx, faktaPerJalur, produk)));
  const pkg = bacaPackageJson();
  if (pkg) situs.push(periksaDependensi(pkg));
  if (!opsi.skipTtfb) {
    log("Mengukur TTFB ...");
    situs.push(...(await ukurTtfb(ctx, produk)));
  }

  const semua = [
    ...situs.map((h) => ({ lingkup: "situs", ...h })),
    ...[...perHalaman.values()].flat().map((h) => ({ lingkup: "halaman", ...h })),
  ];
  const hitung = (s) => semua.filter((h) => h.status === s).length;
  return {
    baseUrl: ctx.base,
    mode: ctx.mode,
    prodHost: ctx.prodHost,
    waktu: new Date().toISOString(),
    lokasiUkur: process.env.LOKASI_UKUR ?? null,
    jumlahUrl: adaSitemap ? jalur.length : null,
    ringkasan: { lulus: hitung("LULUS"), gagal: hitung("GAGAL"), peringatan: hitung("PERINGATAN") },
    hasil: semua,
    perHalaman,
    situs,
  };
}

/** package.json repo ini (tools/ ada di akar repo); null bila skrip dijalankan di luar repo. */
function bacaPackageJson() {
  try {
    return JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  } catch {
    return null;
  }
}

const label = (s) => `[${s}]`.padEnd(13);

function cetakTeks(lap) {
  const baris = [];
  baris.push(`cek-seo ${lap.baseUrl}`);
  baris.push(
    `Mode: ${lap.mode}${lap.mode === "produksi" ? "" : ` (noindex diharapkan; prod-host ${lap.prodHost})`} | URL sitemap: ${lap.jumlahUrl ?? "tidak terbaca"} | ${lap.waktu}`,
  );
  baris.push("", "== Pemeriksaan situs ==");
  for (const h of lap.situs) baris.push(`${label(h.status)}${h.cek.padEnd(22)}${tampilUrl(h.url).padEnd(34)} ${h.pesan}`);
  baris.push("", `== Pemeriksaan per halaman (${lap.perHalaman.size}) ==`);
  for (const [url, h] of lap.perHalaman) {
    const g = h.filter((x) => x.status === "GAGAL").length;
    const p = h.filter((x) => x.status === "PERINGATAN").length;
    const status = g ? "GAGAL" : p ? "PERINGATAN" : "LULUS";
    baris.push(`${label(status)}${tampilUrl(url)}  (${h.length - g - p} lulus, ${g} gagal, ${p} peringatan)`);
    for (const x of h.filter((y) => y.status !== "LULUS")) baris.push(`    ${label(x.status)}${x.cek.padEnd(14)} ${x.pesan}`);
  }
  const r = lap.ringkasan;
  baris.push("", `Ringkasan: ${r.lulus} LULUS, ${r.gagal} GAGAL, ${r.peringatan} PERINGATAN`);
  baris.push(r.gagal ? "HASIL: GAGAL (exit code 1)" : "HASIL: LULUS");
  return baris.join("\n");
}

async function main() {
  let opsi;
  try {
    opsi = parseArgumen(process.argv.slice(2));
  } catch (e) {
    if (!(e instanceof GalatPakai)) throw e;
    process.stderr.write(`${e.message}\nPemakaian: node tools/cek-seo.mjs <baseUrl> [--json] [--skip-ttfb] [--prod-host ${PROD_HOST_BAWAAN}]\n`);
    process.exitCode = 2;
    return;
  }
  const lap = await jalankan(opsi);
  if (opsi.json) {
    const { perHalaman: _p, situs: _s, ...jejak } = lap;
    process.stdout.write(`${JSON.stringify(jejak, null, 2)}\n`);
  } else {
    process.stdout.write(`${cetakTeks(lap)}\n`);
  }
  process.exitCode = lap.ringkasan.gagal ? 1 : 0;
}

// Jalankan hanya bila berkas dieksekusi langsung, bukan saat di-import (mis. skrip uji).
const langsung = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (langsung) {
  main().catch((e) => {
    process.stderr.write(`cek-seo gagal dijalankan: ${e?.stack ?? e}\n`);
    process.exitCode = 2;
  });
}
