import "server-only";
import { cache } from "react";
import area from "@/data/area.json";
import katalogData from "@/data/katalog.json";
import {
  BUIS_JENIS,
  BUIS_SIZES,
  COLORS,
  DEFAULT_SELECTION,
  GENTENG_COLORS,
  GREFFEL_SIZES,
  KANSTIN_SIZES,
  SAMPEL_CATEGORIES,
  SAMPEL_PRODUCTS,
  UDITCH_SIZES,
  getProductOptionGroups,
  getProductSpecs,
  getProductTkdnBadge,
  type BuisJenisKey,
} from "@/data/sampel";
import { priceLabel, rupiah } from "@/lib/format";
import { memo } from "@/lib/memo";
import { listArticleSummaries, listPages, listProducts } from "@/lib/queries";
import { getSettings, parseFaq } from "@/lib/settings";

export type SearchItemType = "produk" | "sampel" | "artikel" | "area" | "katalog" | "info";

export type SearchIndexItem = {
  id: string;
  type: SearchItemType;
  typeLabel: string;
  title: string;
  url: string;
  badge?: string;
  subtitle?: string;
  text: string;
};

type WilayahJson = {
  nama: string;
  slug?: string;
  ringkas?: string;
  jarak?: string;
};

const AREA_CORRIDOR_KEYWORDS: Record<string, string> = {
  "Kabupaten Purwakarta": "Tol Cipularang Gerbang Tol Sadang Jatiluhur Ciganea prioritas pabrik Pasawahan",
  "Karawang & Cikampek": "Tol Jakarta-Cikampek Japek Sadang Cikopo Karawang Barat Timur KIIC Suryacipta",
  Subang: "Tol Cipali Kalijati Cipeundeuy Pagaden Pamanukan Subang",
  "Bekasi & Cikarang": "Tol Jakarta-Cikampek Jababeka EJIP MM2100 Delta Silicon skala proyek Cikarang Bekasi",
  Jabodetabek: "Tol Jakarta-Cikampek JORR Jagorawi Tol Dalam Kota Jakarta Bogor Depok Tangerang skala proyek minimal order",
  "Cirebon & Indramayu": "Tol Cipali Kertajati Palimanan konfirmasi jadwal Cirebon Indramayu",
  Bandung: "Tol Cipularang Pasteur Buah Batu Bandung",
  Cimahi: "Tol Cipularang Padalarang Baros Cimahi",
  "Bandung Barat": "Tol Cipularang Padalarang Ngamprah Batujajar Bandung Barat",
  Cianjur: "Plered Cirata Padalarang Tol Cipularang Cianjur",
  Sumedang: "Tol Cipali Subang Tol Cisumdawu Jatinangor Tanjungsari Sumedang",
};

const PRODUCT_ALIASES: Record<string, string> = {
  "paving-block": "paving blok konblok K-350 K-400 K-450 6 cm 8 cm abu natural merah hitam Truepave bata Hexagon segi enam Fullpave ubin Grass Block",
  "u-ditch": "uditch u ditch saluran drainase K-350 K-400 cover heavy duty 30×30 30×40 40×40 40×50 40×60 50×50 50×60 50×70 60×60 60×70 60×80 80×80 cm",
  "buis-beton": "gorong-gorong sumur resapan hong K-300 tumbuk cor bertulang diameter 20 30 40 50 60 80 cm tutup buis",
  kanstin: "kansteen kastin kerb pembatas jalan trotoar taman stopper ban tali air KS 20 25 28 30 DKI jumbo",
  "genteng-beton": "atap beton Garuda gelombang Flat datar nok bubungan ujung jurai lisplang triway apex merah hitam",
  "greffel-beton": "Alias: Gravel (Greffel) beton, saluran setengah lingkaran, selokan terbuka, cor, tumbuk",
  "jasa-pasang-paving": "tukang pasang paving borongan pemasangan min 200 m2 garansi survei gratis stamper abu batu makadam",
};

function cleanText(raw: string, maxLen = 1400): string {
  const cleaned = raw
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~#>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen).replace(/\s+\S*$/, "")}…`;
}

function buildSearchIndexImpl(): Promise<SearchIndexItem[]> {
  return memo("search-index", async () => {
    const [s, products, articles, pages] = await Promise.all([
      getSettings(),
      listProducts(),
      listArticleSummaries(),
      listPages(),
    ]);

    const items: SearchIndexItem[] = [];

    // 1. Produk & Varian Harga (D1)
    for (const p of products) {
      const priceStr = priceLabel(p);
      const specText = (p.specs ?? []).map((sp) => `${sp.label}: ${sp.value}`).join("; ");
      const rowText = (p.priceRows ?? [])
        .map((r) => {
          const pTxt = r.price != null ? `${rupiah(r.price)}/${r.unit}` : "hubungi admin";
          return `${r.variant}${r.detail ? ` (${r.detail})` : ""} ${pTxt}`;
        })
        .join(" · ");
      const faqText = (p.faq ?? []).map((f) => `${f.q} ${f.a}`).join(" ");
      const tkdnText = p.tkdn ? `TKDN ${p.tkdn}% sertifikat Kemenperin` : "";
      const alias = PRODUCT_ALIASES[p.slug] ?? "";

      items.push({
        id: `prod-${p.slug}`,
        type: "produk",
        typeLabel: "Produk",
        title: p.name,
        url: `/produk/${p.slug}`,
        badge: p.tkdn ? `TKDN ${p.tkdn}%` : p.category,
        subtitle: `${priceStr}${p.summary ? ` · ${p.summary}` : ""}`,
        text: cleanText(
          [p.name, p.category, priceStr, tkdnText, p.summary, specText, rowText, faqText, p.description, alias]
            .filter(Boolean)
            .join(" · "),
          1800,
        ),
      });
    }

    // 2. 21 Sampel & Spesifikasi (src/data/sampel.ts)
    const catNameById = new Map(SAMPEL_CATEGORIES.map((c) => [c.id, c.name]));
    for (const sp of SAMPEL_PRODUCTS) {
      const catName = catNameById.get(sp.cat) ?? sp.cat;
      const tkdn = getProductTkdnBadge(sp, DEFAULT_SELECTION);
      const specs = getProductSpecs(sp, DEFAULT_SELECTION)
        .map(([k, v]) => `${k}: ${v}`)
        .join("; ");
      const optGroups = getProductOptionGroups(sp, DEFAULT_SELECTION)
        .map((g) => `${g.label}: ${g.vals.map((v) => v.t).join(", ")}`)
        .join("; ");

      let extraVariants = "";
      if (sp.id === "buis-beton") {
        extraVariants = BUIS_SIZES.map((b) => {
          const jenisList = (Object.keys(b.w) as BuisJenisKey[]).map((j) => `${BUIS_JENIS[j]} ${b.w[j]} kg`).join("/");
          return `${b.v} cm Ø luar ${b.od} cm tebal ${b.tb} cm (${jenisList})`;
        }).join(" · ");
      } else if (sp.id === "u-ditch") {
        extraVariants = `${UDITCH_SIZES.map((u) => `${u.v} cm (${u.mm} mm, ${u.w} kg)`).join(" · ")} uditch K-350 K-400`;
      } else if (sp.id === "greffel") {
        extraVariants = `Alias: Gravel (Greffel) · ${GREFFEL_SIZES.map((g) => `Ø${g.v} cm (luar ${g.od} cm)`).join(", ")} · Cor & Tumbuk`;
      } else if (sp.id === "kanstin-ks") {
        extraVariants = KANSTIN_SIZES.map((k) => `${k.v} cm`).join(" · ");
      } else if (sp.cat === "paving") {
        extraVariants = `Warna ${Object.values(COLORS).map((c) => c.name).join(", ")} · Mutu K-350 K-400 K-450`;
      } else if (sp.cat === "genteng") {
        extraVariants = `Warna ${GENTENG_COLORS.map((c) => c.t).join(", ")}`;
      }

      const tableText = sp.table ? sp.table.rows.map((r) => r.cells.join(" ")).join(" · ") : "";

      items.push({
        id: `sampel-${sp.code}`,
        type: "sampel",
        typeLabel: "Sampel",
        title: sp.full,
        url: `/sampel?k=${sp.code}`,
        badge: tkdn ? `${tkdn} · ${catName}` : catName,
        subtitle: `${sp.size ? `${sp.size} · ` : ""}${sp.sub}`,
        text: cleanText(
          [sp.name, sp.full, catName, tkdn ?? "", sp.size ?? "", sp.sub, specs, optGroups, extraVariants, tableText, sp.use.join(" · ")]
            .filter(Boolean)
            .join(" · "),
          1200,
        ),
      });
    }

    // 3. Artikel & Panduan (~200 D1 rows)
    for (const a of articles) {
      const topics = a.coverMeta?.topics?.length ? a.coverMeta.topics.join(" ") : "";
      items.push({
        id: `art-${a.slug}`,
        type: "artikel",
        typeLabel: "Artikel",
        title: a.title,
        url: `/artikel/${a.slug}`,
        badge: a.category,
        subtitle: a.excerpt,
        text: cleanText(`${a.title} ${a.category} ${a.excerpt} ${topics}`, 550),
      });
    }

    // 4. Area Pengiriman & Koridor Tol (area.json + published pages)
    const wilayahList = area.wilayah as WilayahJson[];
    const wilayahBySlug = new Map<string, WilayahJson>();
    for (const w of wilayahList) {
      if (w.slug) wilayahBySlug.set(w.slug, w);
    }

    items.push({
      id: "area-index",
      type: "area",
      typeLabel: "Area Kirim",
      title: "Area Pengiriman, Peta Koridor Tol & Simulasi Ongkir",
      url: "/area-pengiriman",
      badge: "Armada Sendiri",
      subtitle: "Truk crane & flatbed dari Pasawahan, Purwakarta via Tol Cipularang, Japek, dan Cipali.",
      text: cleanText(
        `${area.intro} ${area.ongkir.join(" ")} ${area.catatanJabodetabek} ${s.delivery_cities} Tol Cipularang Tol Jakarta-Cikampek Tol Cipali`,
        900,
      ),
    });

    const liveAreaSlugs = new Set<string>();
    const liveInfoSlugs = new Set<string>();

    for (const pg of pages) {
      if (pg.slug === "sampel" || pg.slug === "katalog") continue;
      if (pg.kind === "area") {
        liveAreaSlugs.add(pg.slug);
        const matchedW = wilayahBySlug.get(pg.slug);
        const corridor = matchedW ? AREA_CORRIDOR_KEYWORDS[matchedW.nama] ?? "" : "";
        items.push({
          id: `page-area-${pg.slug}`,
          type: "area",
          typeLabel: "Area Kirim",
          title: pg.title,
          url: `/${pg.slug}`,
          badge: matchedW?.jarak || "Koridor Kirim",
          subtitle: pg.excerpt || matchedW?.ringkas || "Pengiriman armada sendiri dari pabrik Purwakarta.",
          text: cleanText(
            `${pg.title} ${pg.excerpt} ${matchedW?.ringkas ?? ""} ${matchedW?.jarak ?? ""} ${corridor} ${pg.content}`,
            900,
          ),
        });
      } else {
        liveInfoSlugs.add(pg.slug);
        items.push({
          id: `page-info-${pg.slug}`,
          type: "info",
          typeLabel: "Informasi",
          title: pg.title,
          url: `/${pg.slug}`,
          badge: pg.slug === "sertifikat-tkdn" ? "TKDN Kemenperin" : "Halaman Info",
          subtitle: pg.excerpt || undefined,
          text: cleanText(`${pg.title} ${pg.excerpt} ${pg.content}`, 800),
        });
      }
    }

    for (const w of wilayahList) {
      if (w.slug && liveAreaSlugs.has(w.slug)) continue;
      const corridor = AREA_CORRIDOR_KEYWORDS[w.nama] ?? "";
      const fallbackSub =
        w.ringkas ||
        (w.nama === "Jabodetabek"
          ? "Jakarta, Bogor, Depok, dan Tangerang khusus pesanan skala proyek."
          : `Pengiriman armada sendiri dari pabrik Pasawahan ke ${w.nama}.`);
      items.push({
        id: `wilayah-${w.nama.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        type: "area",
        typeLabel: "Area Kirim",
        title: `Pengiriman ke ${w.nama}`,
        url: "/area-pengiriman#wilayah",
        badge: w.jarak || (w.nama === "Jabodetabek" ? "Skala Proyek" : "Jawa Barat"),
        subtitle: fallbackSub,
        text: cleanText(
          `${w.nama} ${fallbackSub} ${w.jarak ?? ""} ${corridor} ${w.nama === "Jabodetabek" ? area.catatanJabodetabek : ""}`,
          600,
        ),
      });
    }

    // 5. Katalog Brosur (11 Halaman)
    for (const slide of katalogData) {
      const gravelNote = slide.page === 7 ? " Alias: Gravel beton setengah lingkaran" : "";
      items.push({
        id: `katalog-${slide.page}`,
        type: "katalog",
        typeLabel: "Katalog PDF",
        title: `Halaman ${slide.page}: ${slide.title}`,
        url: `/katalog?halaman=${slide.page}#katalog-viewer`,
        badge: `Hal. ${String(slide.page).padStart(2, "0")} / ${katalogData.length}`,
        subtitle: slide.summary,
        text: cleanText(`Katalog brosur PDF halaman ${slide.page} ${slide.title} ${slide.summary}${gravelNote}`, 400),
      });
    }

    // 6. Alat, Fitur Utama & FAQ Beranda
    const toolItems: SearchIndexItem[] = [
      {
        id: "tool-pola-paving",
        type: "info",
        typeLabel: "Kalkulator",
        title: "Kalkulator Pola, Motif & Warna Paving Block",
        url: "/pola-paving",
        badge: "Alat Hitung",
        subtitle: "Atur motif susun bata, tulang ikan, catur, kombinasi warna abu/merah/hitam, plus hitung kanstin, abu batu & base course.",
        text: "Kalkulator pola paving warna motif Truepave Hexagon Fullpave 21 30 Grass Block abu batu base course kanstin cadangan 5% 10%",
      },
      {
        id: "tool-paket-proyek",
        type: "info",
        typeLabel: "Pengadaan",
        title: "Paket Material Proyek 1 Pintu & Harga Acuan",
        url: "/paket-proyek",
        badge: "Tender & TKDN",
        subtitle: "Gabungkan paving block, kanstin, U-Ditch, buis beton, gravel (greffel), dan genteng dalam satu penawaran tertulis + dokumen TKDN.",
        text: "Paket proyek kontraktor pengadaan tender BUMN pemerintah 1 pintu penawaran tertulis harga acuan TKDN 91,58% 78,61% 100%",
      },
      {
        id: "tool-galeri",
        type: "info",
        typeLabel: "Galeri",
        title: "Galeri Dokumentasi Pemasangan & Stok Pabrik (24 Foto)",
        url: "/galeri",
        badge: "24 Foto",
        subtitle: "Dokumentasi proyek pemasangan paving hexagon, bata, kombinasi warna, serta stok U-Ditch, buis beton, dan kanstin di pabrik.",
        text: "Galeri foto dokumentasi hasil pemasangan paving block stok pabrik Pasawahan Purwakarta proyek",
      },
      {
        id: "tool-sampel-home",
        type: "info",
        typeLabel: "Sampel",
        title: "Katalog Sampel Fisik & Estimator 21 Produk",
        url: "/sampel",
        badge: "21 Produk",
        subtitle: "Bandingkan spesifikasi teknis, ukuran, warna, mutu beton, TKDN, dan estimasi kebutuhan tiap varian.",
        text: "Sampel fisik QR code spesifikasi ukuran warna mutu beton estimator paving genteng u-ditch buis gravel greffel kanstin",
      },
      {
        id: "tool-kontak",
        type: "info",
        typeLabel: "Kontak",
        title: "Kontak, Alamat Pabrik & Jam Operasional",
        url: "/kontak",
        badge: "Purwakarta",
        subtitle: `${s.address} · ${s.hours} · WA ${s.whatsapp}`,
        text: cleanText(`Kontak alamat pabrik lokasi Google Maps WhatsApp ${s.whatsapp} telepon ${s.phone} ${s.phone_office} ${s.email} ${s.address} ${s.hours}`, 400),
      },
    ];

    if (!liveInfoSlugs.has("sertifikat-tkdn")) {
      toolItems.push({
        id: "fallback-tkdn",
        type: "info",
        typeLabel: "Sertifikat",
        title: "Sertifikat TKDN Kemenperin (91,58% · 78,61% · 100%)",
        url: "/sertifikat-tkdn",
        badge: "TKDN Kemenperin",
        subtitle: s.tkdn_note,
        text: `Sertifikat TKDN Kemenperin paving block 91,58% U-Ditch 78,61% buis beton 100% ${s.tkdn_note}`,
      });
    }

    items.push(...toolItems);

    // FAQ Beranda (settings.home_faq)
    const faqList = parseFaq(s.home_faq);
    faqList.forEach((f, idx) => {
      items.push({
        id: `faq-${idx + 1}`,
        type: "info",
        typeLabel: "FAQ",
        title: f.q,
        url: "/#faq-title",
        badge: "Tanya Jawab",
        subtitle: f.a,
        text: cleanText(`${f.q} ${f.a}`, 500),
      });
    });

    return items;
  });
}

export const getSearchIndex = cache(buildSearchIndexImpl);
