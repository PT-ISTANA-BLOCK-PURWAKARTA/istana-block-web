import { PAVING_CATALOG } from "@/lib/paving/catalog";

export type SampelCategoryId = "paving" | "genteng" | "saluran" | "kanstin";

export type SampelCategory = {
  id: SampelCategoryId;
  name: string;
  desc: string;
};

export type ColorKey = "N" | "M" | "H";
export type GentengColorKey = "M" | "H";
export type BuisJenisKey = "tumbuk" | "cor" | "tulang";
export type GreffelJenisKey = "cor" | "tumbuk";

export const COLORS: Record<ColorKey, { name: string; hex: string }> = {
  N: { name: "Abu Natural", hex: "#CFCFCB" },
  M: { name: "Merah", hex: "#C4382E" },
  H: { name: "Hitam", hex: "#2E2E30" },
};

export const GENTENG_COLORS: { v: GentengColorKey; t: string; sw: string }[] = [
  { v: "M", t: "Merah", sw: "#D9705F" },
  { v: "H", t: "Hitam", sw: "#141414" },
];

export const SAMPEL_CATEGORIES: SampelCategory[] = [
  {
    id: "paving",
    name: "Paving Block",
    desc: "Truepave, Hexagon, Fullpave 21/30 & Grass Block (TKDN 91,58%)",
  },
  {
    id: "genteng",
    name: "Genteng & Aksesoris",
    desc: "Genteng Garuda, Flat, Nok, Lisplang, Triway & Apex",
  },
  {
    id: "saluran",
    name: "U-Ditch & Buis",
    desc: "U-Ditch, Tutup U-Ditch, Buis Beton, Tutup Buis & Gravel (Greffel)",
  },
  {
    id: "kanstin",
    name: "Kanstin",
    desc: "Kanstin KS, Kanstin S & Stopper Ban",
  },
];

export type TrustKey =
  | "tkdnPav"
  | "mutuPav"
  | "sni"
  | "tkdnUd"
  | "mutuUd"
  | "tkdnBb"
  | "mutuBb"
  | "pasang"
  | "warna"
  | "satu"
  | "pabrik";

export type TrustNote = {
  key: TrustKey;
  badge: string;
  title: string;
  body: string;
  externalUrl?: string;
  externalLabel?: string;
  internalHref?: string;
  internalLabel?: string;
};

export const TRUST_NOTES: Record<TrustKey, TrustNote> = {
  tkdnPav: {
    key: "tkdnPav",
    badge: "TKDN",
    title: "Bersertifikat TKDN 91,58%",
    body: " dari Kementerian Perindustrian, No. 9656/SJ-IND.8/TKDN/LVI/08/2026, berlaku sampai 18 Agustus 2031. Cocok untuk proyek pemerintah & BUMN.",
    externalUrl: "https://tkdn.kemenperin.go.id/",
    externalLabel: "Cek di situs TKDN",
    internalHref: "/sertifikat-tkdn",
    internalLabel: "Detail sertifikat",
  },
  mutuPav: {
    key: "mutuPav",
    badge: "K",
    title: "Mutu beton K-350 s.d. K-450",
    body: ", warna natural maupun berwarna, sesuai rincian sertifikat.",
  },
  sni: {
    key: "sni",
    badge: "SNI",
    title: "Berstandar SNI",
    body: ", diproduksi di pabrik sendiri sejak 2016.",
  },
  tkdnUd: {
    key: "tkdnUd",
    badge: "TKDN",
    title: "Bersertifikat TKDN 78,61%",
    body: " untuk U-Ditch mutu K350 s.d. K450, No. 9657/SJ-IND.8/TKDN/LVI/08/2026, berlaku sampai 18 Agustus 2031.",
    externalUrl: "https://tkdn.kemenperin.go.id/",
    externalLabel: "Cek di situs TKDN",
    internalHref: "/sertifikat-tkdn",
    internalLabel: "Detail sertifikat",
  },
  mutuUd: {
    key: "mutuUd",
    badge: "K",
    title: "Mutu K-350",
    body: ", besi U-50 drawn wire (500 MPa) & BJDT fy 420 MPa, sambungan male–female, metode wet cast.",
  },
  tkdnBb: {
    key: "tkdnBb",
    badge: "TKDN",
    title: "Bersertifikat TKDN 100%",
    body: " untuk buis beton tanpa tulangan 20×100 s.d. 80×100 cm, No. 9632/SJ-IND.8/TKDN/LVI/08/2026, berlaku sampai 18 Agustus 2031.",
    externalUrl: "https://tkdn.kemenperin.go.id/",
    externalLabel: "Cek di situs TKDN",
    internalHref: "/sertifikat-tkdn",
    internalLabel: "Detail sertifikat",
  },
  mutuBb: {
    key: "mutuBb",
    badge: "K",
    title: "Mutu K-300",
    body: ", metode wet cast. Tersedia tumbuk, cor, dan bertulang (besi U-50 drawn wire & BJDT fy 420 MPa).",
  },
  pasang: {
    key: "pasang",
    badge: "Jasa",
    title: "Jasa pemasangan & perbaikan atap",
    body: " genteng beton juga tersedia. Tanyakan ke admin.",
  },
  warna: {
    key: "warna",
    badge: "Warna",
    title: "Bisa pesan warna khusus",
    body: " sesuai kebutuhan proyek Anda.",
  },
  satu: {
    key: "satu",
    badge: "1",
    title: "Satu pabrik untuk jalan & saluran",
    body: ": paving, kanstin, U-Ditch, buis beton, dan gravel (greffel) bisa dipesan sekaligus.",
  },
  pabrik: {
    key: "pabrik",
    badge: "Pabrik",
    title: "Langsung dari pabrik",
    body: " di Jl. Terusan Kapten Halim No. 121, Pasawahan, Purwakarta, berdiri sejak 2016. Kirim ke Jawa Barat & Jabodetabek.",
  },
};

export type BuisSize = {
  v: string;
  d: number;
  len: number;
  od: number;
  tb: number;
  w: Partial<Record<BuisJenisKey, string>>;
};

export const BUIS_SIZES: BuisSize[] = [
  { v: "20 × 100", d: 20, len: 100, od: 27, tb: 5, w: { tumbuk: "50" } },
  { v: "30 × 100", d: 30, len: 100, od: 37, tb: 5, w: { tumbuk: "96" } },
  { v: "40 × 100", d: 40, len: 100, od: 48, tb: 6, w: { tumbuk: "116,5" } },
  { v: "50 × 100", d: 50, len: 100, od: 60, tb: 8, w: { tumbuk: "170" } },
  { v: "60 × 100", d: 60, len: 100, od: 72, tb: 10, w: { tumbuk: "211", cor: "245" } },
  { v: "80 × 50", d: 80, len: 50, od: 96, tb: 14, w: { tumbuk: "230", cor: "292" } },
  { v: "80 × 100", d: 80, len: 100, od: 96, tb: 14, w: { cor: "584", tulang: "592" } },
];

export const BUIS_JENIS: Record<BuisJenisKey, string> = {
  tumbuk: "Tumbuk",
  cor: "Cor",
  tulang: "Bertulang",
};

export type UditchSize = {
  v: string;
  mm: string;
  w: string;
  bawah: number;
  atas: string;
};

const RAW_UDITCH: [string, string, number, string][] = [
  ["300×300", "163,3", 60, "45"],
  ["300×400", "196,1", 60, "47,5"],
  ["400×400", "248,6", 70, "50"],
  ["400×500", "284,8", 70, "52,5"],
  ["400×600", "314,9", 70, "50"],
  ["500×500", "373,8", 70, "75"],
  ["500×600", "416", 90, "72,5"],
  ["500×700", "456,8", 90, "70"],
  ["600×600", "472", 85, "75"],
  ["600×700", "513,5", 85, "72"],
  ["600×800", "553,6", 85, "70"],
  ["800×800", "653,7", 100, "75"],
];

export const UDITCH_SIZES: UditchSize[] = RAW_UDITCH.map(([mm, w, bawah, atas]) => {
  const [a, b] = mm.split("×").map(Number);
  return { v: `${a / 10} × ${b / 10}`, mm, w, bawah, atas };
});

export type GreffelSize = { v: string; od: number; t: string };

export const GREFFEL_SIZES: GreffelSize[] = [
  { v: "20", od: 27, t: "20 cm" },
  { v: "30", od: 37, t: "30 cm" },
  { v: "40", od: 48, t: "40 cm" },
  { v: "50", od: 60, t: "50 cm" },
];

export type KanstinSize = { v: string; len: number };

export const KANSTIN_SIZES: KanstinSize[] = [
  { v: "40 × 20 × 10", len: 40 },
  { v: "40 × 25 × 12/15", len: 40 },
  { v: "40 × 28 × 12/15", len: 40 },
  { v: "60 × 30 × 18/22", len: 60 },
];

export type SampelSelection = {
  tebal: string;
  warna: ColorKey;
  wg: GentengColorKey;
  ud: string;
  bb: string;
  jenis: BuisJenisKey;
  gr: string;
  jenis2: GreffelJenisKey;
  kn: string;
};

export const DEFAULT_SELECTION: SampelSelection = {
  tebal: "6",
  warna: "N",
  wg: "M",
  ud: "30 × 30",
  bb: "20 × 100",
  jenis: "tumbuk",
  gr: "20",
  jenis2: "cor",
  kn: "40 × 20 × 10",
};

export type OptionKey = keyof SampelSelection;

export type OptionValue = {
  v: string;
  t: string;
  sw?: string;
};

export type OptionGroup = {
  k: OptionKey;
  label: string;
  vals: OptionValue[];
};

export type ProductTable = {
  h: string;
  head: string[];
  k: "ud" | "bb";
  rows: { key: string; cells: string[] }[];
};

export type ProductEstimate = {
  unit: "m2" | "m" | "pcs";
  label: string;
  ph: string;
  per?: number;
  extra?: number;
  len?: (s: SampelSelection) => number;
  after?: string;
};

export type SampelProduct = {
  id: string;
  code: string;
  cat: SampelCategoryId;
  name: string;
  full: string;
  size?: string;
  pcs?: number;
  tebal?: number[];
  warna?: ColorKey[];
  calcJenis?: "truepave" | "hexagon" | "fp21" | "fp30" | "grass";
  tkdnBadge?: string;
  img: string | ((s: SampelSelection) => string);
  sub: string;
  opts?: OptionGroup[] | ((s: SampelSelection) => OptionGroup[]);
  specs: [string, string][] | ((s: SampelSelection) => [string, string][]);
  detail?: (s: SampelSelection) => string;
  table?: ProductTable;
  est: ProductEstimate;
  link: string;
  linkT: string;
  priceLink?: string;
  priceLinkT?: string;
  trust: TrustKey[] | ((s: SampelSelection) => TrustKey[]);
  rel: string[];
  layers?: boolean;
  use: string[];
};

export function parsePositiveNumber(v: string): number {
  let s = String(v || "").replace(/\s/g, "");
  if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function formatNumberId(n: number): string {
  return n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

function pick<T extends { v: string }>(list: T[], v: string): T {
  for (const item of list) if (item.v === v) return item;
  return list[0];
}

const IMG_BASE = "/img/sampel/";

function makePaving(cfg: {
  id: string;
  code: string;
  name: string;
  size: string;
  pcs: number;
  tebal: number[];
  warna: ColorKey[];
  calcJenis: "truepave" | "hexagon" | "fp21" | "fp30" | "grass";
  imgFile: string;
  sub: string;
  use: string[];
}): SampelProduct {
  return {
    id: cfg.id,
    code: cfg.code,
    cat: "paving",
    name: cfg.name,
    full: `Paving ${cfg.name}`,
    size: cfg.size,
    pcs: cfg.pcs,
    tebal: cfg.tebal,
    warna: cfg.warna,
    calcJenis: cfg.calcJenis,
    tkdnBadge: "TKDN 91,58%",
    img: `${IMG_BASE}${cfg.imgFile}`,
    sub: cfg.sub,
    use: cfg.use,
    est: {
      unit: "m2",
      label: "Luas area (m²)",
      ph: "contoh: 50",
      per: cfg.pcs,
      extra: 1.05,
    },
    link: `/pola-paving?jenis=${cfg.calcJenis}`,
    linkT: "Lihat Motif & Hitung Material Lengkap",
    priceLink: "/produk/paving-block",
    priceLinkT: "Lihat Halaman Harga Paving Block",
    trust: ["tkdnPav", "mutuPav", "sni", "pabrik"],
    rel: ["kn", "kns", "sb"],
    layers: true,
    opts: () => [
      {
        k: "tebal",
        label: "Tebal",
        vals: cfg.tebal.map((t) => ({
          v: String(t),
          t: `${t} cm${t === 8 ? " · kendaraan berat" : ""}`,
        })),
      },
      {
        k: "warna",
        label: "Warna",
        vals: cfg.warna.map((c) => ({
          v: c,
          t: COLORS[c].name,
          sw: COLORS[c].hex,
        })),
      },
    ],
    specs: () => [
      ["Ukuran", cfg.size],
      ["Isi per m²", `${formatNumberId(cfg.pcs)} pcs`],
      ["Tebal", `${cfg.tebal.join(" & ")} cm`],
      ["Mutu beton", "K-350 s.d. K-450"],
    ],
    detail: (s) => `${cfg.size}, tebal ${s.tebal} cm, warna ${COLORS[s.warna].name}`,
  };
}

const GENTENG_CODES = ["gg", "gf", "ng", "nf", "lp", "nu", "tw", "ap"] as const;

function makeGenteng(cfg: {
  id: string;
  code: string;
  name: string;
  full: string;
  size?: string;
  imgFile: string;
  sub: string;
  specs: [string, string][];
  est: ProductEstimate;
  use: string[];
  wg?: boolean;
}): SampelProduct {
  return {
    id: cfg.id,
    code: cfg.code,
    cat: "genteng",
    name: cfg.name,
    full: cfg.full,
    size: cfg.size,
    img: `${IMG_BASE}${cfg.imgFile}`,
    sub: cfg.sub,
    specs: cfg.specs,
    est: cfg.est,
    use: cfg.use,
    link: "/produk/genteng-beton",
    linkT: "Lihat Halaman Genteng Beton",
    trust: ["pasang", "warna", "pabrik"],
    rel: GENTENG_CODES.filter((c) => c !== cfg.code),
    ...(cfg.wg
      ? {
          opts: [
            {
              k: "wg" as const,
              label: "Warna",
              vals: GENTENG_COLORS,
            },
          ],
          detail: (s: SampelSelection) =>
            `${cfg.size ? `${cfg.size}, ` : ""}warna ${s.wg === "H" ? "Hitam" : "Merah"}`,
        }
      : {}),
  };
}

export const SAMPEL_PRODUCTS: SampelProduct[] = [
  makePaving({
    id: "truepave",
    code: "tp",
    name: "Truepave",
    size: "21 × 10,5 cm",
    pcs: PAVING_CATALOG.truepave.labelPcsPerM2,
    tebal: [6, 8],
    warna: ["N", "M", "H"],
    calcJenis: "truepave",
    imgFile: "paving-block-truepave-istana-block-tkdn-o.webp",
    sub: "Paving bata paling serbaguna, bisa dipasang pola bata, tulang ikan, sampai anyaman.",
    use: [
      "Carport, halaman & jalan perumahan",
      "Area parkir dan jalan lingkungan",
      "Tebal 8 cm untuk lalu lintas kendaraan berat",
      "Bisa dikombinasikan dengan Fullpave 21",
    ],
  }),
  makePaving({
    id: "hexagon",
    code: "hx",
    name: "Hexagon",
    size: "20 × 20 cm",
    pcs: PAVING_CATALOG.hexagon.labelPcsPerM2,
    tebal: [6, 8],
    warna: ["N", "M", "H"],
    calcJenis: "hexagon",
    imgFile: "paving-block-hexagon-istana-block-tkdn-o.webp",
    sub: "Bentuk segi enam yang saling mengunci, tampilan rapi untuk area luas.",
    use: [
      "Taman, trotoar & halaman",
      "Area publik dan fasilitas umum",
      "Motif garis, titik, bunga dua–tiga warna",
      "Sisakan cadangan ±10% untuk potongan tepi",
    ],
  }),
  makePaving({
    id: "fullpave21",
    code: "f21",
    name: "Fullpave 21",
    size: "21 × 21 cm",
    pcs: PAVING_CATALOG.fp21.labelPcsPerM2,
    tebal: [6, 8],
    warna: ["N", "M", "H"],
    calcJenis: "fp21",
    imgFile: "paving-block-fullpave-istana-block-tkdn-o.webp",
    sub: "Paving ubin persegi berpermukaan rata, kesan bersih dan modern.",
    use: [
      "Teras, selasar & area duduk",
      "Kafe, ruko dan halaman kantor",
      "Motif catur, bingkai atau diagonal",
      "Modul cocok dipadukan dengan Truepave",
    ],
  }),
  makePaving({
    id: "fullpave30",
    code: "f30",
    name: "Fullpave 30",
    size: "30 × 30 cm",
    pcs: PAVING_CATALOG.fp30.labelPcsPerM2,
    tebal: [6, 8],
    warna: ["N", "M", "H"],
    calcJenis: "fp30",
    imgFile: "paving-block-fullpave-30-istana-block.webp",
    sub: "Ubin paving ukuran besar, pemasangan lebih cepat untuk area lapang.",
    use: [
      "Plaza, halaman luas & area komersial",
      "Selasar dan jalur pejalan kaki",
      "Motif catur atau garis dua warna",
      "Lebih sedikit keping per m²",
    ],
  }),
  makePaving({
    id: "grassblock",
    code: "gb",
    name: "Grass Block",
    size: "45 × 30 cm",
    pcs: PAVING_CATALOG.grass.labelPcsPerM2,
    tebal: [6, 8],
    warna: ["N"],
    calcJenis: "grass",
    imgFile: "paving-grass-block-istana-block-tkdn-o.webp",
    sub: "Paving berlubang untuk rumput, area tetap hijau dan menyerap air.",
    use: [
      "Carport & parkir yang tetap hijau",
      "Area resapan air hujan",
      "Pola jalur roda untuk hemat material",
      "Tersedia warna abu natural",
    ],
  }),

  makeGenteng({
    id: "genteng-garuda",
    code: "gg",
    name: "Genteng Garuda",
    full: "Genteng Beton Garuda",
    size: "42 × 34 cm",
    imgFile: "5548-opt-o.webp",
    sub: "Genteng beton bergelombang dengan tampilan klasik, kuat menghadapi cuaca ekstrem.",
    specs: [
      ["Ukuran", "42 × 34 cm"],
      ["Model", "Gelombang"],
      ["Nok pasangan", "Nok Garuda"],
      ["Bahan", "Beton pracetak"],
    ],
    est: {
      unit: "m2",
      label: "Luas atap (m²)",
      ph: "contoh: 120",
      after: "Jumlah genteng dihitung admin sesuai bentuk atap.",
    },
    use: [
      "Rumah tinggal & perumahan",
      "Bangunan bergaya klasik atau tradisional",
      "Tahan hujan deras, angin & panas terik",
      "Lengkapi dengan Nok Garuda di bubungan",
    ],
  }),
  makeGenteng({
    id: "genteng-flat",
    code: "gf",
    name: "Genteng Flat",
    full: "Genteng Beton Flat",
    imgFile: "5553-opt-o.webp",
    sub: "Genteng beton datar untuk atap bergaya modern dan minimalis.",
    specs: [
      ["Model", "Flat (datar)"],
      ["Tampilan", "Modern & minimalis"],
      ["Nok pasangan", "Nok Flat"],
      ["Bahan", "Beton pracetak"],
    ],
    est: {
      unit: "m2",
      label: "Luas atap (m²)",
      ph: "contoh: 120",
      after: "Jumlah genteng dihitung admin sesuai bentuk atap.",
    },
    use: [
      "Rumah modern & minimalis",
      "Tampilan atap rapi dan bersih",
      "Pemasangan relatif cepat",
      "Lengkapi dengan Nok Flat di bubungan",
    ],
  }),
  makeGenteng({
    id: "nok-garuda",
    code: "ng",
    name: "Nok Garuda",
    full: "Nok Genteng Beton Garuda",
    size: "36 × 25 cm",
    imgFile: "5551-opt-o.webp",
    sub: "Penutup bubungan (nok) untuk atap Genteng Beton Garuda.",
    specs: [
      ["Ukuran", "36 × 25 cm"],
      ["Posisi", "Bubungan (nok)"],
      ["Pasangan", "Genteng Garuda"],
      ["Bahan", "Beton pracetak"],
    ],
    est: {
      unit: "m",
      label: "Panjang bubungan (m)",
      ph: "contoh: 12",
    },
    use: [
      "Penutup bubungan atap genteng Garuda",
      "Melindungi sambungan di puncak atap",
      "Tampilan serasi dengan genteng Garuda",
    ],
  }),
  makeGenteng({
    id: "nok-flat",
    code: "nf",
    name: "Nok Flat",
    full: "Nok Genteng Beton Flat",
    size: "42 × 25 cm",
    imgFile: "5549-opt-opt.webp",
    sub: "Penutup bubungan dengan garis simpel, melengkapi Genteng Beton Flat.",
    specs: [
      ["Ukuran", "42 × 25 cm"],
      ["Posisi", "Bubungan (nok)"],
      ["Pasangan", "Genteng Flat"],
      ["Bahan", "Beton pracetak"],
    ],
    est: {
      unit: "m",
      label: "Panjang bubungan (m)",
      ph: "contoh: 12",
    },
    use: [
      "Penutup bubungan atap genteng Flat",
      "Garis atap simpel dan bersih",
      "Hasil akhir serasi dengan genteng Flat",
    ],
  }),
  makeGenteng({
    id: "lisplang",
    code: "lp",
    name: "Lisplang",
    full: "Genteng Beton Lisplang",
    imgFile: "5555-opt-o.webp",
    sub: "Aksesoris tepi atap: aksen rapi sekaligus pelindung tambahan dari air hujan.",
    specs: [
      ["Posisi", "Tepi samping atap"],
      ["Fungsi", "Aksen & pelindung tepi"],
    ],
    est: {
      unit: "m",
      label: "Panjang tepi atap (m)",
      ph: "contoh: 16",
    },
    use: [
      "Penutup tepi samping atap",
      "Aksen rapi di tepian atap",
      "Perlindungan tambahan dari air hujan",
    ],
  }),
  makeGenteng({
    id: "nok-ujung",
    code: "nu",
    name: "Nok Ujung",
    full: "Genteng Beton Nok Ujung Jurai",
    imgFile: "genteng-beton-nok-ujung-jurai-istana-block.webp",
    wg: true,
    sub: "Nok ujung jurai: penutup ujung bubungan dan sudut atap agar rapat dan rapi.",
    specs: [
      ["Posisi", "Ujung bubungan"],
      ["Fungsi", "Penutup sudut atap"],
    ],
    est: {
      unit: "pcs",
      label: "Jumlah (pcs)",
      ph: "contoh: 4",
    },
    use: [
      "Ujung bubungan dan sudut atap",
      "Tampilan ujung atap lebih rapi",
      "Melindungi ujung atap dari rembesan",
    ],
  }),
  makeGenteng({
    id: "triway",
    code: "tw",
    name: "Triway",
    full: "Genteng Beton Triway",
    imgFile: "5558-opt-o.webp",
    sub: "Nok tiga arah untuk titik pertemuan bubungan, desain unik yang menambah karakter atap.",
    specs: [
      ["Posisi", "Pertemuan 3 bubungan"],
      ["Cocok untuk", "Atap limas / perisai"],
    ],
    est: {
      unit: "pcs",
      label: "Jumlah (pcs)",
      ph: "contoh: 2",
    },
    use: [
      "Titik pertemuan tiga bubungan",
      "Atap limas atau perisai",
      "Sambungan puncak atap lebih rapi",
    ],
  }),
  makeGenteng({
    id: "apex-4-arah",
    code: "ap",
    name: "Apex 4 Arah",
    full: "Nok 4 Arah (Apex)",
    imgFile: "genteng-beton-apex-4-arah-istana-block.webp",
    wg: true,
    sub: "Penutup puncak atap tempat empat bubungan bertemu, untuk atap limas piramida.",
    specs: [
      ["Posisi", "Pertemuan 4 bubungan"],
      ["Cocok untuk", "Atap limas piramida"],
    ],
    est: {
      unit: "pcs",
      label: "Jumlah (pcs)",
      ph: "contoh: 1",
    },
    use: [
      "Puncak atap tempat empat bubungan bertemu",
      "Atap limas piramida (bujur sangkar)",
      "Sambungan puncak atap lebih rapat dan rapi",
    ],
  }),

  {
    id: "u-ditch",
    code: "ud",
    cat: "saluran",
    name: "U-Ditch",
    full: "U-Ditch Beton",
    tkdnBadge: "TKDN 78,61%",
    img: `${IMG_BASE}5570-opt-opt.webp`,
    sub: "Saluran beton pracetak berbentuk U, cepat dipasang dan kuat untuk drainase jalan maupun kawasan industri.",
    opts: [
      {
        k: "ud",
        label: "Ukuran (cm)",
        vals: UDITCH_SIZES.map((u) => ({ v: u.v, t: u.v })),
      },
    ],
    specs: (s) => {
      const u = pick(UDITCH_SIZES, s.ud);
      return [
        ["Ukuran", `${u.v} × 120 cm`],
        ["Berat", `${u.w} kg`],
        ["Tebal bawah", `${u.bawah} mm`],
        ["Tebal atas", `${u.atas} mm`],
        ["Mutu beton", "K-350"],
        ["Sambungan", "Male–female"],
      ];
    },
    detail: (s) => `${pick(UDITCH_SIZES, s.ud).v} × 120 cm`,
    table: {
      h: "Daftar ukuran U-Ditch",
      head: ["Ukuran (mm)", "Berat (kg)", "Tebal bawah", "Tebal atas"],
      k: "ud",
      rows: UDITCH_SIZES.map((u) => ({
        key: u.v,
        cells: [`${u.mm}×1200`, u.w, `${u.bawah} mm`, `${u.atas} mm`],
      })),
    },
    est: {
      unit: "m",
      label: "Panjang saluran (m)",
      ph: "contoh: 60",
      len: () => 120,
    },
    link: "/produk/u-ditch",
    linkT: "Lihat Halaman U-Ditch",
    trust: ["tkdnUd", "mutuUd", "satu", "pabrik"],
    rel: ["tud", "bb", "kn"],
    use: [
      "Drainase jalan, perumahan & kawasan",
      "Kawasan industri, gudang & pabrik",
      "Saluran tepi jalan lingkungan",
      "Bisa dilengkapi Tutup U-Ditch",
    ],
  },
  {
    id: "tutup-u-ditch",
    code: "tud",
    cat: "saluran",
    name: "Tutup U-Ditch",
    full: "Tutup U-Ditch Beton",
    img: `${IMG_BASE}5576-opt-o.webp`,
    sub: "Penutup saluran U-Ditch agar area di atasnya aman dan rapi.",
    specs: [
      ["Ukuran", "Menyesuaikan U-Ditch"],
      ["Bahan", "Beton pracetak"],
    ],
    est: {
      unit: "m",
      label: "Panjang saluran (m)",
      ph: "contoh: 60",
      after: "Jumlah tutup dihitung admin sesuai ukuran U-Ditch.",
    },
    link: "/produk/u-ditch",
    linkT: "Lihat Halaman U-Ditch",
    trust: ["satu", "pabrik"],
    rel: ["ud"],
    use: [
      "Menutup saluran U-Ditch",
      "Area pejalan kaki & akses masuk",
      "Saluran lebih aman dan rapi",
    ],
  },
  {
    id: "buis-beton",
    code: "bb",
    cat: "saluran",
    name: "Buis Beton",
    full: "Buis Beton",
    tkdnBadge: "TKDN 100%",
    img: (s) => {
      const b = pick(BUIS_SIZES, s.bb);
      if (s.jenis === "tulang") return `${IMG_BASE}5567-opt-opt.webp`;
      if (b.d === 20) return `${IMG_BASE}5559-opt-opt.webp`;
      if (b.v === "80 × 50") return `${IMG_BASE}5564-opt-opt.webp`;
      if (b.d === 80) return `${IMG_BASE}5565-opt-opt.webp`;
      return `${IMG_BASE}buis-beton-istana-block-ukuran-tkdn-o.webp`;
    },
    sub: "Buis beton (gorong-gorong) pracetak, tersedia tumbuk, cor, dan bertulang.",
    opts: (s) => {
      const b = pick(BUIS_SIZES, s.bb);
      const jenisKeys = Object.keys(b.w) as BuisJenisKey[];
      return [
        {
          k: "bb",
          label: "Ukuran (cm)",
          vals: BUIS_SIZES.map((item) => ({ v: item.v, t: item.v })),
        },
        {
          k: "jenis",
          label: "Jenis",
          vals: jenisKeys.map((j) => ({ v: j, t: BUIS_JENIS[j] })),
        },
      ];
    },
    specs: (s) => {
      const b = pick(BUIS_SIZES, s.bb);
      const jenisKeys = Object.keys(b.w) as BuisJenisKey[];
      const j = b.w[s.jenis] ? s.jenis : jenisKeys[0];
      return [
        ["Diameter dalam", `${b.d} cm`],
        ["Diameter luar", `${b.od} cm`],
        ["Tebal dinding", `${b.tb} cm`],
        ["Panjang", `${b.len} cm`],
        [`Berat (${BUIS_JENIS[j].toLowerCase()})`, `${b.w[j]} kg`],
        ["Mutu beton", "K-300"],
      ];
    },
    detail: (s) => {
      const b = pick(BUIS_SIZES, s.bb);
      const jenisKeys = Object.keys(b.w) as BuisJenisKey[];
      const j = b.w[s.jenis] ? s.jenis : jenisKeys[0];
      return `${b.v} cm, ${BUIS_JENIS[j].toLowerCase()}`;
    },
    table: {
      h: "Daftar ukuran buis beton",
      head: ["Ukuran (cm)", "Tumbuk", "Cor", "Bertulang", "Tebal", "Ø luar"],
      k: "bb",
      rows: BUIS_SIZES.map((b) => ({
        key: b.v,
        cells: [
          b.v,
          b.w.tumbuk ? `${b.w.tumbuk} kg` : "–",
          b.w.cor ? `${b.w.cor} kg` : "–",
          b.w.tulang ? `${b.w.tulang} kg` : "–",
          `${b.tb} cm`,
          `${b.od} cm`,
        ],
      })),
    },
    est: {
      unit: "m",
      label: "Panjang saluran (m)",
      ph: "contoh: 20",
      len: (s) => pick(BUIS_SIZES, s.bb).len,
    },
    link: "/produk/buis-beton",
    linkT: "Lihat Halaman Buis Beton",
    trust: (s) => (s.jenis === "tulang" ? ["mutuBb", "satu", "pabrik"] : ["tkdnBb", "mutuBb", "satu", "pabrik"]),
    rel: ["tbb", "gr", "ud"],
    use: [
      "Gorong-gorong & saluran air",
      "Drainase perumahan dan jalan",
      "Sumur resapan",
      "Bertulang untuk beban lebih berat",
    ],
  },
  {
    id: "tutup-buis",
    code: "tbb",
    cat: "saluran",
    name: "Tutup Buis",
    full: "Tutup Buis Beton Besi",
    size: "100 × 8 cm",
    img: `${IMG_BASE}5568-opt-o.webp`,
    sub: "Tutup buis beton bertulang besi.",
    specs: [
      ["Ukuran", "100 × 8 cm"],
      ["Bahan", "Beton bertulang besi"],
    ],
    est: {
      unit: "pcs",
      label: "Jumlah (pcs)",
      ph: "contoh: 4",
    },
    link: "/produk/buis-beton",
    linkT: "Lihat Halaman Buis Beton",
    trust: ["satu", "pabrik"],
    rel: ["bb"],
    use: [
      "Penutup buis beton & sumur",
      "Tutup beton bertulang besi",
      "Area rumah, taman & fasilitas umum",
    ],
  },
  {
    id: "greffel",
    code: "gr",
    cat: "saluran",
    name: "Gravel (Greffel)",
    full: "Gravel (Greffel) Beton",
    img: `${IMG_BASE}5569-opt-o.webp`,
    sub: "Saluran beton setengah lingkaran, tersedia cor dan tumbuk.",
    opts: [
      {
        k: "gr",
        label: "Diameter",
        vals: GREFFEL_SIZES.map((g) => ({ v: g.v, t: g.t })),
      },
      {
        k: "jenis2",
        label: "Jenis",
        vals: [
          { v: "cor", t: "Cor" },
          { v: "tumbuk", t: "Tumbuk" },
        ],
      },
    ],
    specs: (s) => {
      const g = pick(GREFFEL_SIZES, s.gr);
      return [
        ["Diameter dalam", `${g.v} cm`],
        ["Diameter luar", `${g.od} cm`],
        ["Panjang", "100 cm"],
        ["Jenis", "Cor & tumbuk"],
      ];
    },
    detail: (s) => `${pick(GREFFEL_SIZES, s.gr).v} × 100 cm, ${s.jenis2}`,
    est: {
      unit: "m",
      label: "Panjang saluran (m)",
      ph: "contoh: 30",
      len: () => 100,
    },
    link: "/produk/greffel-beton",
    linkT: "Lihat Halaman Gravel (Greffel) Beton",
    trust: ["satu", "pabrik"],
    rel: ["bb", "ud"],
    use: [
      "Saluran air setengah lingkaran",
      "Drainase tepi jalan & halaman",
      "Selokan dan saluran irigasi",
    ],
  },

  {
    id: "kanstin-ks",
    code: "kn",
    cat: "kanstin",
    name: "Kanstin KS",
    full: "Kanstin KS",
    img: `${IMG_BASE}5543-opt-o.webp`,
    sub: "Kanstin beton pembatas jalan, trotoar, dan tepi area paving.",
    opts: [
      {
        k: "kn",
        label: "Ukuran (cm)",
        vals: KANSTIN_SIZES.map((k) => ({ v: k.v, t: k.v })),
      },
    ],
    specs: (s) => {
      const k = pick(KANSTIN_SIZES, s.kn);
      return [
        ["Ukuran", `${k.v} cm`],
        ["Panjang per buah", `${k.len} cm`],
        ["Isi per meter", `${formatNumberId(Math.round(1000 / k.len) / 10)} pcs`],
        ["Bahan", "Beton pracetak"],
      ];
    },
    detail: (s) => `${pick(KANSTIN_SIZES, s.kn).v} cm`,
    est: {
      unit: "m",
      label: "Panjang (m)",
      ph: "contoh: 40",
      len: (s) => pick(KANSTIN_SIZES, s.kn).len,
    },
    link: "/produk/kanstin",
    linkT: "Lihat Halaman Kanstin",
    trust: ["satu", "pabrik"],
    rel: ["tp", "kns", "sb"],
    use: [
      "Pembatas jalan & trotoar",
      "Pengunci tepi area paving",
      "Taman dan area parkir",
    ],
  },
  {
    id: "kanstin-s",
    code: "kns",
    cat: "kanstin",
    name: "Kanstin S",
    full: "Kanstin S",
    size: "40 × 30 × 10/18 cm",
    img: `${IMG_BASE}5544-opt-o.webp`,
    sub: "Kanstin dengan profil lengkung (S) untuk tepi jalan yang rapi.",
    specs: [
      ["Ukuran", "40 × 30 × 10/18 cm"],
      ["Panjang per buah", "40 cm"],
      ["Isi per meter", "2,5 pcs"],
      ["Profil", "Lengkung (S)"],
    ],
    est: {
      unit: "m",
      label: "Panjang (m)",
      ph: "contoh: 40",
      len: () => 40,
    },
    link: "/produk/kanstin",
    linkT: "Lihat Halaman Kanstin",
    trust: ["satu", "pabrik"],
    rel: ["kn", "sb", "tp"],
    use: [
      "Tepi jalan perumahan & kawasan",
      "Pembatas trotoar",
      "Tepi area paving",
    ],
  },
  {
    id: "stopper-ban",
    code: "sb",
    cat: "kanstin",
    name: "Stopper Ban",
    full: "Kanstin Stopper Ban",
    size: "60 × 16 × 7/16,5 cm",
    img: `${IMG_BASE}5547-opt-o.webp`,
    sub: "Penahan roda kendaraan agar posisi parkir teratur dan aman.",
    specs: [
      ["Ukuran", "60 × 16 × 7/16,5 cm"],
      ["Panjang", "60 cm"],
      ["Fungsi", "Penahan roda"],
      ["Bahan", "Beton pracetak"],
    ],
    est: {
      unit: "pcs",
      label: "Jumlah (pcs)",
      ph: "contoh: 10",
    },
    link: "/produk/kanstin",
    linkT: "Lihat Halaman Kanstin",
    trust: ["satu", "pabrik"],
    rel: ["kn", "gb", "tp"],
    use: [
      "Area parkir gedung & ruko",
      "Carport rumah",
      "Mengatur posisi parkir kendaraan",
    ],
  },
];

export const SAMPEL_BY_KEY: Record<string, SampelProduct> = (() => {
  const map: Record<string, SampelProduct> = {};
  for (const p of SAMPEL_PRODUCTS) {
    map[p.id.toLowerCase()] = p;
    map[p.code.toLowerCase()] = p;
  }
  return map;
})();

export function getProductOptionGroups(p: SampelProduct, s: SampelSelection): OptionGroup[] {
  if (!p.opts) return [];
  return typeof p.opts === "function" ? p.opts(s) : p.opts;
}

/** Menyelaraskan nilai opsi agar selalu valid untuk produk/ukuran aktif (mis. Buis 80×100 tanpa jenis tumbuk). */
export function normalizeSelection(p: SampelProduct, current: SampelSelection): SampelSelection {
  const next = { ...current };
  for (let pass = 0; pass < 2; pass++) {
    const groups = getProductOptionGroups(p, next);
    for (const g of groups) {
      if (g.vals.length && !g.vals.some((v) => v.v === next[g.k])) {
        (next as Record<string, string>)[g.k] = g.vals[0].v;
      }
    }
  }
  return next;
}

export function getProductImage(p: SampelProduct, s: SampelSelection): string {
  return typeof p.img === "function" ? p.img(s) : p.img;
}

export function getProductSpecs(p: SampelProduct, s: SampelSelection): [string, string][] {
  return typeof p.specs === "function" ? p.specs(s) : p.specs;
}

export function getProductTrustKeys(p: SampelProduct, s: SampelSelection): TrustKey[] {
  return typeof p.trust === "function" ? p.trust(s) : p.trust;
}

export function getProductDetail(p: SampelProduct, s: SampelSelection): string {
  return p.detail ? p.detail(s) : p.size || "";
}

export function getProductTkdnBadge(p: SampelProduct, s: SampelSelection): string | undefined {
  if (p.id === "buis-beton" && s.jenis === "tulang") return undefined;
  return p.tkdnBadge;
}

export function getProductLink(p: SampelProduct, s: SampelSelection): string {
  if (p.cat === "paving" && p.calcJenis) {
    const q = new URLSearchParams({ jenis: p.calcJenis });
    if (s.tebal) q.set("tebal", s.tebal);
    if (s.warna) q.set("warna", s.warna);
    return `/pola-paving?${q.toString()}`;
  }
  return p.link;
}

export type EstimateResult = {
  pcs: number;
  q: number;
  unitLabel: string;
  headlinePrefix: string;
  headlineHighlight: string;
  headlineSuffix: string;
  waMessage: string;
};

export function computeEstimate(
  p: SampelProduct,
  s: SampelSelection,
  qtyInput: string,
  kotaInput: string,
  from: "" | "s" | "g",
): EstimateResult {
  const e = p.est;
  let q = parsePositiveNumber(qtyInput);
  const kota = kotaInput.trim();
  const unit = e.unit === "m2" ? "m²" : e.unit === "m" ? "m" : "pcs";

  if (e.unit === "pcs") q = Math.ceil(q);

  let pcs = 0;
  if (e.per) pcs = Math.ceil(q * e.per * (e.extra || 1) - 1e-6);
  else if (e.len) pcs = Math.ceil((q * 100) / e.len(s) - 1e-6);
  else if (e.unit === "pcs") pcs = Math.ceil(q);

  const cleanLabel = e.label.replace(/ \(.*\)/, "");
  let headlinePrefix = "";
  let headlineHighlight = "";
  let headlineSuffix = "";

  if (!q) {
    headlinePrefix =
      e.unit === "pcs"
        ? "Isi jumlah yang dibutuhkan."
        : `Isi ${cleanLabel.toLowerCase()}${
            e.per || e.len
              ? " untuk melihat perkiraan jumlah."
              : `. ${e.after || "Jumlah pcs dihitung admin sesuai bentuk atap."}`
          }`;
  } else if (e.per) {
    headlinePrefix = "Perkiraan kebutuhan: ";
    headlineHighlight = `± ${pcs.toLocaleString("id-ID")} pcs`;
    headlineSuffix = ` ${p.name} untuk ${formatNumberId(q)} m²`;
  } else if (e.len) {
    headlinePrefix = "Perkiraan kebutuhan: ";
    headlineHighlight = `± ${pcs.toLocaleString("id-ID")} pcs`;
    headlineSuffix = ` (panjang ${e.len(s)} cm per buah) untuk ${formatNumberId(q)} m`;
  } else if (e.unit === "pcs") {
    headlinePrefix = "Jumlah: ";
    headlineHighlight = `${pcs.toLocaleString("id-ID")} pcs`;
    headlineSuffix = ` ${p.full}`;
  } else {
    headlinePrefix = `${cleanLabel}: `;
    headlineHighlight = `${formatNumberId(q)} ${unit}`;
    headlineSuffix = `. ${e.after || "Jumlah pcs dihitung admin sesuai bentuk atap."}`;
  }

  const intro =
    from === "g"
      ? `saya melihat ${p.full} di galeri Istana Block`
      : from === "s"
        ? `saya sudah melihat sampel ${p.full}`
        : `saya tertarik dengan ${p.full}`;

  const det = getProductDetail(p, s);
  const line = `${cleanLabel}: ${
    q ? `${formatNumberId(q)} ${unit}${pcs && e.unit !== "pcs" ? ` (± ${pcs.toLocaleString("id-ID")} pcs)` : ""}` : ""
  }`;
  const waMessage = `Halo Istana Block, ${intro}${det ? ` (${det})` : ""}.\n${line}\nLokasi pengiriman: ${kota}\nMohon penawaran harganya.`;

  return {
    pcs,
    q,
    unitLabel: unit,
    headlinePrefix,
    headlineHighlight,
    headlineSuffix,
    waMessage,
  };
}

/** SVG cadangan bila foto produk gagal dimuat. */
export function buildTileFallbackDataUri(p: SampelProduct): string {
  const esc = (str: string) => str.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch] || ch);
  let svg: string;
  if (p.cat === "paving") {
    let rects = "";
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        rects += `<rect x="${18 + x * 90}" y="${18 + y * 90}" width="84" height="84" rx="3" fill="${(x + y) % 2 ? "#C4382E" : "#CFCFCB"}" stroke="#5A6475" stroke-width="1.5"/>`;
      }
    }
    svg = `<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="300" fill="#E9ECF3"/>${rects}<text x="150" y="292" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" fill="#0E2A6B" font-weight="700">${esc(p.size || p.name)}</text></svg>`;
  } else {
    svg = `<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="300" fill="#0E2A6B"/><rect y="236" width="300" height="64" fill="#D63F12"/><text x="150" y="128" text-anchor="middle" font-family="Arial,sans-serif" font-size="26" font-weight="800" fill="#fff">${esc(p.name)}</text>${p.size ? `<text x="150" y="162" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" fill="#C9CCF2">${esc(p.size)}</text>` : ""}<text x="150" y="272" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="#fff">Lihat contoh fisiknya di galeri kantor kami</text></svg>`;
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
