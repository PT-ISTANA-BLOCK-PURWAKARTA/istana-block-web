import { describe, expect, it } from "vitest";
import {
  adalahLinkPendek,
  barisLokasiWa,
  hostDiizinkan,
  koordinatDariHtmlGoogle,
  lokasiEfektif,
  koordinatDariUrlGoogle,
  linkGoogleMaps,
  parseHasilNominatim,
  parseKoordinat,
  periksaUrlGoogle,
  tafsirMasukan,
  titikTengahPoligon,
  tujuanRedirect,
  urlNominatim,
} from "../lokasi";
import { buildShareUrl, createWhatsAppMessage, decodeShareStateFromBase64, encodeShareStateToBase64, readShareCode, type ShareState } from "../share";
import { createRectanglePreset } from "../adapters/preset";
import { calculateMaterialEstimate } from "../engine/estimate";
import { generateLayout } from "../engine/layout";
import type { PatternConfig } from "../engine/types";

describe("koordinat desimal", () => {
  it("menerima koma, spasi, titik koma, dan desimal koma", () => {
    for (const t of ["-6.5569, 107.4433", "-6.5569,107.4433", "-6.5569 107.4433", "-6.5569;107.4433", "  -6.5569 ,  107.4433 ", "-6,5569 107,4433", "-6,5569; 107,4433"]) {
      expect(parseKoordinat(t), t).toEqual({ ok: true, lat: -6.5569, lng: 107.4433 });
    }
  });
  it("menerima bilangan bulat dan batas rentang", () => {
    expect(parseKoordinat("90, 180")).toEqual({ ok: true, lat: 90, lng: 180 });
    expect(parseKoordinat("-90 -180")).toEqual({ ok: true, lat: -90, lng: -180 });
    expect(parseKoordinat("0,0")).toEqual({ ok: true, lat: 0, lng: 0 });
  });
  it("menolak di luar rentang", () => {
    const r1 = parseKoordinat("91, 100");
    expect(r1 && !r1.ok && r1.pesan).toMatch(/Lintang/);
    const r2 = parseKoordinat("10, 181");
    expect(r2 && !r2.ok && r2.pesan).toMatch(/Bujur/);
  });
  it("memberi pesan bila urutan tampak terbalik", () => {
    const r = parseKoordinat("107.4433, -6.5569");
    expect(r && !r.ok && r.pesan).toMatch(/terbalik/);
    expect(r && !r.ok && r.pesan).toContain("-6.5569, 107.4433");
  });
  it("mengembalikan null untuk bukan pasangan angka", () => {
    expect(parseKoordinat("Bungursari")).toBeNull();
    expect(parseKoordinat("")).toBeNull();
    expect(parseKoordinat("1,2,3")).toBeNull();
    expect(parseKoordinat("-6.5569")).toBeNull();
  });
});

describe("tautan Google Maps panjang", () => {
  const tujuan = { lat: -6.5569, lng: 107.4433 };
  const kasus: Array<[string, string, { lat: number; lng: number }]> = [
    ["@lat,lng", "https://www.google.com/maps/@-6.5569,107.4433,17z", tujuan],
    ["@ dengan data", "https://www.google.com/maps/@-6.5569,107.4433,19z/data=!3m1!1e3", tujuan],
    ["q=lat,lng", "https://maps.google.com/?q=-6.5569,107.4433", tujuan],
    ["q= dengan %2C", "https://www.google.com/maps?q=-6.5569%2C107.4433", tujuan],
    ["q= dengan +", "https://www.google.com/maps?q=-6.5569+107.4433", tujuan],
    ["q=loc:", "https://maps.google.com/maps?q=loc:-6.5569,107.4433&z=15", tujuan],
    ["ll=", "https://maps.google.com/maps?ll=-6.5569,107.4433&z=17&t=k", tujuan],
    ["query=", "https://www.google.com/maps/search/?api=1&query=-6.5569%2C107.4433", tujuan],
    ["destination=", "https://www.google.com/maps/dir/?api=1&destination=-6.5569,107.4433", tujuan],
    ["/place/lat,lng", "https://www.google.com/maps/place/-6.5569,107.4433", tujuan],
    ["/place/ terenkode", "https://www.google.com/maps/place/-6.5569%2C107.4433/@-6.5,107.4,17z", tujuan],
    ["/search/lat,+lng", "https://www.google.com/maps/search/-6.5569,+107.4433", tujuan],
    [
      "place bernama: !3d!4d lebih diutamakan daripada @",
      "https://www.google.com/maps/place/Istana+Block/@-6.55,107.44,17z/data=!3m1!4b1!4m6!3m5!1s0x2e690e:0xabc!8m2!3d-6.5569!4d107.4433!16s%2Fg%2F11abc",
      tujuan,
    ],
    ["tanpa skema", "google.com/maps/@-6.5569,107.4433,17z", tujuan],
    ["google.co.id", "https://www.google.co.id/maps/@-6.5569,107.4433,17z", tujuan],
    ["koordinat belahan lain", "https://www.google.com/maps/@40.7128,-74.006,12z", { lat: 40.7128, lng: -74.006 }],
  ];
  for (const [nama, url, harap] of kasus) {
    it(nama, () => expect(koordinatDariUrlGoogle(url)).toEqual(harap));
  }
  it("null bila tidak ada koordinat atau di luar rentang", () => {
    expect(koordinatDariUrlGoogle("https://www.google.com/maps/place/Bungursari+Purwakarta")).toBeNull();
    expect(koordinatDariUrlGoogle("https://www.google.com/maps/@999,107.4433,17z")).toBeNull();
    expect(koordinatDariUrlGoogle("https://maps.google.com/?q=Purwakarta")).toBeNull();
  });
  it("koordinatDariHtmlGoogle: meta center, !3d!4d, dan /@", () => {
    expect(koordinatDariHtmlGoogle('<meta content="https://maps.google.com/maps/api/staticmap?center=-6.5569%2C107.4433&zoom=15">')).toEqual(tujuan);
    expect(koordinatDariHtmlGoogle('x!8m2!3d-6.5569!4d107.4433y')).toEqual(tujuan);
    expect(koordinatDariHtmlGoogle('href="/maps/@-6.5569,107.4433,17z"')).toEqual(tujuan);
    expect(koordinatDariHtmlGoogle("<html>halo@contoh.com 1,2</html>")).toBeNull();
  });
});

describe("deteksi format kotak masukan", () => {
  it("koordinat", () => {
    expect(tafsirMasukan("-6.5569, 107.4433")).toEqual({ jenis: "koordinat", hasil: { ok: true, lat: -6.5569, lng: 107.4433 } });
  });
  it("koordinat terbalik tetap dikenali sebagai koordinat (bukan nama)", () => {
    const t = tafsirMasukan("107.4433, -6.5569");
    expect(t.jenis).toBe("koordinat");
  });
  it("link panjang", () => {
    const t = tafsirMasukan("https://www.google.com/maps/@-6.5569,107.4433,17z");
    expect(t).toEqual({ jenis: "link-panjang", hasil: { ok: true, lat: -6.5569, lng: 107.4433 } });
  });
  it("link panjang tanpa koordinat memberi pesan", () => {
    const t = tafsirMasukan("https://www.google.com/maps/place/Bungursari");
    expect(t.jenis).toBe("link-panjang");
    expect(t.jenis === "link-panjang" && !t.hasil.ok).toBe(true);
  });
  it("link pendek", () => {
    expect(tafsirMasukan("https://maps.app.goo.gl/AbCd123xyz").jenis).toBe("link-pendek");
    expect(tafsirMasukan("maps.app.goo.gl/AbCd123xyz").jenis).toBe("link-pendek");
    expect(tafsirMasukan("https://goo.gl/maps/AbCd123").jenis).toBe("link-pendek");
  });
  it("tautan situs lain ditolak, bukan dicari sebagai nama", () => {
    const t = tafsirMasukan("https://contoh.com/halaman");
    expect(t.jenis).toBe("link-panjang");
    expect(t.jenis === "link-panjang" && !t.hasil.ok).toBe(true);
  });
  it("nama tempat", () => {
    expect(tafsirMasukan("Bungursari Purwakarta")).toEqual({ jenis: "nama", kueri: "Bungursari Purwakarta" });
    expect(tafsirMasukan("Jl. Veteran No. 12, Purwakarta").jenis).toBe("nama");
  });
  it("kosong", () => {
    expect(tafsirMasukan("   ")).toEqual({ jenis: "kosong" });
  });
  it("adalahLinkPendek", () => {
    expect(adalahLinkPendek("https://goo.gl/other")).toBe(false);
    expect(adalahLinkPendek("https://www.google.com/maps/@1,2,3z")).toBe(false);
    expect(adalahLinkPendek("https://maps.app.goo.gl/x")).toBe(true);
  });
});

describe("pemeriksa SSRF", () => {
  it("menerima host daftar putih lewat https", () => {
    for (const u of [
      "https://maps.app.goo.gl/AbC",
      "https://goo.gl/maps/AbC",
      "https://maps.google.com/?q=1,2",
      "https://www.google.com/maps/@1,2,3z",
      "https://google.com/maps",
      "https://www.google.co.id/maps",
      "https://maps.google.co.id/maps",
      "https://MAPS.APP.GOO.GL/AbC",
      "https://www.google.com:443/maps",
    ]) {
      expect(periksaUrlGoogle(u).ok, u).toBe(true);
    }
  });
  it("menolak host di luar daftar", () => {
    for (const u of [
      "https://evil.com/",
      "https://google.com.evil.com/",
      "https://evil.com/?u=https://maps.app.goo.gl/x",
      "https://maps.app.goo.gl.evil.com/",
      "https://notgoogle.com/",
      "https://evilgoogle.co.id/",
      "https://google.co.id.evil.com/",
      "https://maps.app.goo.gl@evil.com/",
      "https://consent.google.com/",
      "https://accounts.google.com/",
      "https://www.google.com./maps",
    ]) {
      expect(periksaUrlGoogle(u).ok, u).toBe(false);
    }
  });
  it("menolak IP, localhost, metadata cloud, dan IPv6", () => {
    for (const u of [
      "https://127.0.0.1/",
      "https://localhost/",
      "https://169.254.169.254/latest/meta-data/",
      "https://10.0.0.1/",
      "https://[::1]/",
      "https://0x7f000001/",
      "https://2130706433/",
    ]) {
      expect(periksaUrlGoogle(u).ok, u).toBe(false);
    }
  });
  it("menolak skema bukan https, kredensial, dan port lain", () => {
    for (const u of [
      "http://maps.app.goo.gl/x",
      "ftp://maps.app.goo.gl/x",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "https://user:pw@maps.app.goo.gl/x",
      "https://maps.app.goo.gl:8443/x",
      "https://www.google.com:80/x",
      "tidak-valid",
    ]) {
      expect(periksaUrlGoogle(u).ok, u).toBe(false);
    }
  });
  it("hostDiizinkan: regex google.co.id tidak bocor", () => {
    expect(hostDiizinkan("www.google.co.id")).toBe(true);
    expect(hostDiizinkan("google.co.id")).toBe(true);
    expect(hostDiizinkan("google.co.id.evil.com")).toBe(false);
    expect(hostDiizinkan("xgoogle.co.id")).toBe(false);
    expect(hostDiizinkan("evil.com#.google.co.id")).toBe(false);
  });
  it("tujuanRedirect memecahkan Location relatif lalu tetap diperiksa", () => {
    const dari = new URL("https://maps.app.goo.gl/abc");
    const rel = tujuanRedirect(dari, "/maps/place/x");
    expect(rel?.toString()).toBe("https://maps.app.goo.gl/maps/place/x");
    const keluar = tujuanRedirect(dari, "https://evil.com/x");
    expect(keluar && periksaUrlGoogle(keluar).ok).toBe(false);
    const skemaRelatif = tujuanRedirect(dari, "//evil.com/x");
    expect(skemaRelatif && periksaUrlGoogle(skemaRelatif).ok).toBe(false);
    const http = tujuanRedirect(dari, "http://www.google.com/maps");
    expect(http && periksaUrlGoogle(http).ok).toBe(false);
    expect(tujuanRedirect(dari, null)).toBeNull();
  });
});

describe("Nominatim", () => {
  it("URL memakai parameter kebijakan", () => {
    const u = new URL(urlNominatim("Bungursari Purwakarta"));
    expect(u.origin + u.pathname).toBe("https://nominatim.openstreetmap.org/search");
    expect(u.searchParams.get("q")).toBe("Bungursari Purwakarta");
    expect(u.searchParams.get("countrycodes")).toBe("id");
    expect(u.searchParams.get("accept-language")).toBe("id");
    expect(u.searchParams.get("limit")).toBe("5");
    expect(u.searchParams.get("format")).toBe("jsonv2");
  });
  it("menyaring hasil rusak dan membatasi 5", () => {
    const data = [
      { display_name: "A, Purwakarta", lat: "-6.5", lon: "107.4" },
      { display_name: "", lat: "-6.5", lon: "107.4" },
      { display_name: "B", lat: "abc", lon: "107.4" },
      { display_name: "C", lat: "100", lon: "107.4" },
      null,
      ...Array.from({ length: 8 }, (_, i) => ({ display_name: `T${i}`, lat: "-6.6", lon: "107.5" })),
    ];
    const out = parseHasilNominatim(data);
    expect(out).toHaveLength(5);
    expect(out[0]).toEqual({ nama: "A, Purwakarta", lat: -6.5, lng: 107.4 });
    expect(parseHasilNominatim({})).toEqual([]);
  });
});

describe("baris lokasi pesan WA", () => {
  it("link Google Maps q=lat,lng", () => {
    expect(linkGoogleMaps(-6.5569, 107.4433)).toBe("https://maps.google.com/?q=-6.5569,107.4433");
  });
  it("lokasi hasil cari: tanpa tanda perkiraan", () => {
    expect(barisLokasiWa({ lat: -6.5569, lng: 107.4433, asal: "cari" })).toBe("Lokasi proyek: https://maps.google.com/?q=-6.5569,107.4433");
  });
  it("lokasi dari poligon: diberi tanda perkiraan", () => {
    const b = barisLokasiWa({ lat: -6.5569, lng: 107.4433, asal: "poligon" });
    expect(b).toContain("Lokasi proyek: https://maps.google.com/?q=-6.5569,107.4433");
    expect(b).toContain("perkiraan");
  });
  it("tanpa lokasi atau koordinat rusak: null", () => {
    expect(barisLokasiWa(null)).toBeNull();
    expect(barisLokasiWa(undefined)).toBeNull();
    expect(barisLokasiWa({ lat: 200, lng: 0 })).toBeNull();
  });
});

describe("titik tengah poligon", () => {
  it("persegi kecil di Purwakarta", () => {
    const c = titikTengahPoligon([
      [107.4430, -6.5570],
      [107.4436, -6.5570],
      [107.4436, -6.5566],
      [107.4430, -6.5566],
    ]);
    expect(c).toEqual({ lat: -6.5568, lng: 107.4433 });
  });
  it("berbobot luas pada bentuk tidak simetris (segitiga)", () => {
    const c = titikTengahPoligon([[0, 0], [3, 0], [0, 3]]);
    expect(c).toEqual({ lat: 1, lng: 1 });
  });
  it("kurang dari 3 titik: null; segaris jatuh ke rata-rata", () => {
    expect(titikTengahPoligon([[1, 1], [2, 2]])).toBeNull();
    expect(titikTengahPoligon([[0, 0], [2, 2], [4, 4]])).toEqual({ lat: 2, lng: 2 });
  });
});

describe("tautan bagi dengan lokasi", () => {
  const dasar: ShareState = {
    v: 1,
    engineVersion: "1.0.0",
    geom: { kind: "preset", preset: "rectangle", params: { lengthM: 10, widthM: 5 } },
    cfg: { productId: "truepave", motifId: "herringbone90", reservePercent: 5, rotationDeg: 0 },
  };
  it("round-trip tanpa lokasi (tautan lama tetap valid)", () => {
    const dec = decodeShareStateFromBase64(encodeShareStateToBase64(dasar));
    expect(dec).toEqual(dasar);
    expect(dec.lok).toBeUndefined();
  });
  it("round-trip dengan lokasi", () => {
    const st: ShareState = { ...dasar, lok: { lat: -6.5569, lng: 107.4433, asal: "cari" } };
    const url = buildShareUrl("https://istanablock.com/pola-paving", st);
    const dec = decodeShareStateFromBase64(readShareCode(new URL(url).search));
    expect(dec.lok).toEqual({ lat: -6.5569, lng: 107.4433, asal: "cari" });
    expect(dec).toEqual(st);
  });
  it("lokasi tanpa asal tetap valid; lokasi di luar rentang ditolak", () => {
    expect(decodeShareStateFromBase64(encodeShareStateToBase64({ ...dasar, lok: { lat: 1, lng: 2 } })).lok).toEqual({ lat: 1, lng: 2 });
    const rusak = { ...dasar, lok: { lat: 95, lng: 2 } } as ShareState;
    expect(() => decodeShareStateFromBase64(encodeShareStateToBase64(rusak))).toThrow();
  });
  it("kode tautan lama berbentuk JSON tanpa field lok diterima", () => {
    const json = JSON.stringify(dasar);
    const b64 = Buffer.from(json).toString("base64url");
    expect(decodeShareStateFromBase64(b64).lok).toBeUndefined();
  });
});

describe("pesan WhatsApp dengan lokasi", () => {
  const geometry = createRectanglePreset(10, 5);
  const config: PatternConfig = { productId: "truepave", motifId: "herringbone90", reservePercent: 5, rotationDeg: 0 } as PatternConfig;
  const layout = generateLayout(geometry, config);
  const estimate = calculateMaterialEstimate(layout, config, { perimeterM: geometry.metrics.perimeterM });
  const dasar = { whatsappNumber: "628123", shareUrl: "https://x.id/p?d=1", productName: "Truepave", motifName: "Herringbone", geometry, estimate, config };
  it("memuat baris lokasi proyek bila ada", () => {
    const pesan = createWhatsAppMessage({ ...dasar, lokasi: { lat: -6.5569, lng: 107.4433, asal: "cari" } });
    expect(pesan).toContain("Lokasi proyek: https://maps.google.com/?q=-6.5569,107.4433");
    expect(pesan).not.toContain("perkiraan");
  });
  it("menandai perkiraan untuk titik tengah poligon", () => {
    const pesan = createWhatsAppMessage({ ...dasar, lokasi: { lat: -6.5569, lng: 107.4433, asal: "poligon" } });
    expect(pesan).toContain("perkiraan");
  });
  it("tanpa lokasi pesan tidak berubah", () => {
    expect(createWhatsAppMessage(dasar)).not.toContain("Lokasi proyek");
    expect(createWhatsAppMessage({ ...dasar, lokasi: null })).toBe(createWhatsAppMessage(dasar));
  });
});

describe("koma desimal gaya Indonesia", () => {
  const harap = { ok: true, lat: -6.5569, lng: 107.4433 };
  it("terbaca sebagai koordinat, bukan nama (tidak dikirim ke Nominatim)", () => {
    for (const t of ["-6,5569, 107,4433", "-6,5569 107,4433", "-6,5569; 107,4433", "-6,5569 ; 107,4433", "-6,5569,  107,4433"]) {
      expect(tafsirMasukan(t), t).toEqual({ jenis: "koordinat", hasil: harap });
    }
  });
  it("campuran titik dan koma tetap dipahami", () => {
    expect(tafsirMasukan("-6.5569, 107.4433").jenis).toBe("koordinat");
    expect(tafsirMasukan("-6,5, 107,4")).toEqual({ jenis: "koordinat", hasil: { ok: true, lat: -6.5, lng: 107.4 } });
  });
  it("kasus ambigu memberi pesan format, bukan dikirim ke Nominatim", () => {
    for (const t of ["-6,5569,107,4433", "-6,5569, 107", "1,2,3,4", "-6,5569 107"]) {
      const r = tafsirMasukan(t);
      expect(r.jenis, t).toBe("koordinat");
      expect(r.jenis === "koordinat" && !r.hasil.ok, t).toBe(true);
    }
  });
  it("angka tunggal atau nomor jalan tetap dianggap nama", () => {
    expect(tafsirMasukan("12345").jenis).toBe("nama");
    expect(tafsirMasukan("Jl. Veteran 12").jenis).toBe("nama");
  });
});

describe("lokasiEfektif", () => {
  const poligon = { lat: -6.5, lng: 107.4, asal: "poligon" as const };
  const cari = { lat: -6.5, lng: 107.4, asal: "cari" as const };
  it("lokasi poligon hanya berlaku untuk bentuk dari Peta", () => {
    expect(lokasiEfektif(poligon, "map")).toEqual(poligon);
    for (const s of ["preset", "grid", "geojson", "kml", undefined]) expect(lokasiEfektif(poligon, s)).toBeNull();
  });
  it("lokasi hasil cari/GPS tetap berlaku untuk semua sumber", () => {
    for (const s of ["preset", "grid", "map", "geojson", "kml", undefined]) expect(lokasiEfektif(cari, s)).toEqual(cari);
    expect(lokasiEfektif({ lat: 1, lng: 2 }, "preset")).toEqual({ lat: 1, lng: 2 });
  });
  it("tanpa lokasi: null; pesan WA tidak memuat baris lokasi lahan preset", () => {
    expect(lokasiEfektif(null, "map")).toBeNull();
    expect(barisLokasiWa(lokasiEfektif(poligon, "preset"))).toBeNull();
  });
});
