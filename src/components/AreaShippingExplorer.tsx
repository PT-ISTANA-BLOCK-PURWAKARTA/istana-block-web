"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { waLink } from "@/lib/format";
import type { DeliveryRegion } from "./AreaDeliveryMap";

type VolumeChoice = "parsial" | "penuh" | "proyek";
type AccessChoice = "lebar" | "sempit";
type UnloadChoice = "flatbed" | "crane";

type Props = {
  regions: DeliveryRegion[];
  ongkirRules: string[];
  orderSteps: string[];
  whatsapp: string;
};

type MeterItem = {
  label: string;
  score: number;
  status: string;
  tone: "good" | "mid" | "warn";
  note: string;
};

const VOLUME_OPTIONS: Array<{ id: VolumeChoice; label: string; sub: string; fillPct: number }> = [
  { id: "parsial", label: "Muatan parsial (< 1 truk)", sub: "Biaya perjalanan ditanggung volume lebih kecil", fillPct: 38 },
  { id: "penuh", label: "1 Truk Penuh (paling hemat/unit)", sub: "Kapasitas angkut penuh menekan ongkir per unit", fillPct: 92 },
  { id: "proyek", label: "Skala Proyek (multi-truk)", sub: "Jadwal kirim bertahap & cocok untuk proyek/Jabodetabek", fillPct: 100 },
];

const ACCESS_OPTIONS: Array<{ id: AccessChoice; label: string; sub: string }> = [
  { id: "lebar", label: "Jalan lebar / masuk truk besar", sub: "Akses bebas portal rendah & ada ruang manuver" },
  { id: "sempit", label: "Jalan sempit / butuh koordinasi", sub: "Ada portal, tikungan ketat, kabel rendah, atau jam batas" },
];

const UNLOAD_OPTIONS: Array<{ id: UnloadChoice; label: string; sub: string }> = [
  { id: "flatbed", label: "Flatbed standar", sub: "Paving block, kanstin, genteng beton — turun di tepi akses" },
  { id: "crane", label: "Truk Crane — angkat U-Ditch/Buis", sub: "Pracetak berat butuh ruang kaki penahan (outrigger)" },
];

const STEP_META = [
  {
    deliverable: "Volume",
    title: "Hitung produk & volume",
    hint: "Dalam m², pcs, atau meter saluran",
    icon: "volume",
  },
  {
    deliverable: "Pin Lokasi",
    title: "Siapkan alamat & peta",
    hint: "Titik Google Maps titik bongkar",
    icon: "pin",
  },
  {
    deliverable: "Foto Akses",
    title: "Jelaskan akses truk",
    hint: "Lebar jalan, portal, kabel, & ruang turun",
    icon: "access",
  },
  {
    deliverable: "Penawaran Tertulis",
    title: "Kirim WA & terima penawaran",
    hint: "Memuat harga produk, ongkir, & jadwal",
    icon: "quote",
  },
  {
    deliverable: "PO & DP -> Pelunasan Tiba",
    title: "PO, DP & pelunasan tiba",
    hint: "Jadwal dikunci; lunas saat barang tiba",
    icon: "payment",
  },
] as const;

function StepIcon({ kind }: { kind: (typeof STEP_META)[number]["icon"] }) {
  switch (kind) {
    case "volume":
      return (
        <svg viewBox="0 0 28 28" width="26" height="26" aria-hidden="true">
          <polygon points="14,3 24,8.5 24,19.5 14,25 4,19.5 4,8.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M4 8.5L14 14L24 8.5M14 14V25" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
    case "pin":
      return (
        <svg viewBox="0 0 28 28" width="26" height="26" aria-hidden="true">
          <path d="M14 24s7-6.8 7-12.5a7 7 0 1 0-14 0C7 17.2 14 24 14 24Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="14" cy="11.5" r="2.6" fill="currentColor" />
        </svg>
      );
    case "access":
      return (
        <svg viewBox="0 0 28 28" width="26" height="26" aria-hidden="true">
          <rect x="3" y="7" width="22" height="15" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="14" cy="14.5" r="3.6" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M8.5 7l1.5-2.5h8L19.5 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
    case "quote":
      return (
        <svg viewBox="0 0 28 28" width="26" height="26" aria-hidden="true">
          <rect x="6" y="3.5" width="16" height="21" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M10 9.5h8M10 14h8M10 18.5h5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "payment":
      return (
        <svg viewBox="0 0 28 28" width="26" height="26" aria-hidden="true">
          <path d="M3.5 10h13v9h-13z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M16.5 13h4.5l3.5 3.5V19h-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="8" cy="20.5" r="2.2" fill="currentColor" />
          <circle cx="20.5" cy="20.5" r="2.2" fill="currentColor" />
        </svg>
      );
  }
}

export function AreaShippingExplorer({ regions, ongkirRules, orderSteps, whatsapp }: Props) {
  const zoneSelectId = useId();
  const [zoneId, setZoneId] = useState<string>(regions[1]?.id ?? regions[0]?.id ?? "purwakarta");
  const [volume, setVolume] = useState<VolumeChoice>("penuh");
  const [access, setAccess] = useState<AccessChoice>("lebar");
  const [unload, setUnload] = useState<UnloadChoice>("flatbed");

  // Sinkronisasi apabila pengunjung menekan "Simulasikan ongkir wilayah ini" dari panel inspektor peta.
  useEffect(() => {
    const handler = (ev: Event) => {
      const custom = ev as CustomEvent<string>;
      if (typeof custom.detail === "string" && custom.detail) {
        setZoneId(custom.detail);
      }
    };
    window.addEventListener("ib:select-region", handler);
    return () => window.removeEventListener("ib:select-region", handler);
  }, []);

  const selectedZone = useMemo(() => regions.find((r) => r.id === zoneId) ?? null, [regions, zoneId]);
  const isOutsideList = zoneId === "luar-daftar";
  const zoneName = isOutsideList ? "Kota lain di luar daftar" : (selectedZone?.nama ?? "Kabupaten Purwakarta");

  const simulation = useMemo(() => {
    const isProjectZone = !!selectedZone?.projectOnly;
    const isConfirmZone = isOutsideList || !!selectedZone?.needsScheduleConfirm;
    const isPriority = selectedZone?.tier === "prioritas";
    const isNearTol = selectedZone?.tier === "reguler";

    // 1. Efisiensi Ongkir per Unit (kualitatif — tanpa tarif rupiah fiktif)
    let effScore = 76;
    if (volume === "parsial") effScore = isPriority ? 46 : isNearTol ? 36 : 26;
    else if (volume === "penuh") effScore = isPriority ? 94 : isNearTol ? 90 : isConfirmZone ? 78 : 86;
    else effScore = isPriority ? 98 : isConfirmZone ? 86 : 95;

    if (access === "sempit") effScore = Math.max(22, effScore - 8);
    if (unload === "crane" && volume === "parsial") effScore = Math.max(20, effScore - 6);

    const effTone: MeterItem["tone"] = effScore >= 80 ? "good" : effScore >= 50 ? "mid" : "warn";
    const effStatus =
      volume === "parsial"
        ? "Kurang efisien per unit"
        : volume === "penuh"
          ? "Optimal (1 truk penuh)"
          : "Sangat optimal (skala proyek)";
    const effNote =
      volume === "parsial"
        ? "Muatan belum memenuhi bak truk sehingga porsi ongkir per m²/pcs terasa lebih tinggi."
        : volume === "penuh"
          ? "Kapasitas satu truk terisi maksimal sehingga biaya jalan dibagi rata ke volume terbanyak."
          : "Pengiriman multi-truk memaksimalkan efisiensi ritase dan sinkronisasi jadwal proyek.";

    // 2. Kemudahan Penjadwalan Rute
    let schedScore = 75;
    if (isProjectZone && volume === "parsial") schedScore = 30;
    else if (isOutsideList) schedScore = 44;
    else if (isConfirmZone) schedScore = 52;
    else if (isPriority) schedScore = 95;
    else if (isNearTol) schedScore = 88;
    else if (isProjectZone) schedScore = 76;

    if (access === "sempit") schedScore = Math.max(24, schedScore - 8);

    const schedTone: MeterItem["tone"] = schedScore >= 75 ? "good" : schedScore >= 50 ? "mid" : "warn";
    const schedStatus =
      isProjectZone && volume === "parsial"
        ? "Perlu memenuhi minimal proyek"
        : isConfirmZone
          ? "Konfirmasi jadwal admin"
          : isPriority
            ? "Paling mudah dijadwalkan"
            : "Terjadwal via koridor tol";
    const schedNote =
      isProjectZone && volume === "parsial"
        ? `${zoneName} khusus melayani skala proyek dengan volume minimal yang disepakati per proyek.`
        : isOutsideList
          ? "Kota di luar daftar reguler perlu dicek ketersediaan rute armada oleh admin sebelum pemesanan."
          : isConfirmZone
            ? "Jarak menengah-jauh dari Pasawahan sehingga jadwal dan ritase dikonfirmasi lebih dulu bersama admin."
            : `Berangkat dari Pasawahan melalui ${selectedZone?.koridor ?? "akses tol utama Purwakarta"}.`;

    // 3. Kesiapan Akses & Bongkar
    let accessScore = 92;
    if (access === "lebar" && unload === "crane") accessScore = 80;
    else if (access === "sempit" && unload === "flatbed") accessScore = 54;
    else if (access === "sempit" && unload === "crane") accessScore = 38;

    const accessTone: MeterItem["tone"] = accessScore >= 78 ? "good" : accessScore >= 52 ? "mid" : "warn";
    const accessStatus =
      access === "lebar" && unload === "flatbed"
        ? "Siap bongkar standar"
        : access === "lebar" && unload === "crane"
          ? "Siap dengan ruang outrigger"
          : access === "sempit" && unload === "flatbed"
            ? "Perlu foto titik sempit"
            : "Wajib cek akses & kabel atas";
    const accessNote =
      unload === "crane"
        ? access === "sempit"
          ? "Truk crane butuh ruang tambahan untuk kaki penahan (outrigger) dan bebas kabel melintang rendah."
          : "Pastikan titik bongkar menyediakan ruang bagi kaki penahan crane di sisi saluran atau lahan."
        : access === "sempit"
          ? "Infokan lebar jalan efektif, portal, atau titik bongkar terdekat bila truk besar tidak bisa masuk penuh."
          : "Akses jalan lebar memudahkan armada flatbed merapat dan menurunkan muatan lebih cepat.";

    // Rekomendasi Armada
    const fleetTitle =
      unload === "crane"
        ? volume === "proyek"
          ? "Truk Crane Armada Sendiri (Penjadwalan Bertahap)"
          : "Truk Crane Armada Sendiri"
        : volume === "proyek"
          ? "Truk Flatbed Armada Sendiri (Multi-Truk Proyek)"
          : "Truk Flatbed Armada Sendiri";

    const fleetDetail =
      unload === "crane"
        ? "Disarankan untuk produk beton pracetak berat seperti U-Ditch, cover, dan buis beton agar penurunan aman dan presisi."
        : "Ideal untuk paving block, kanstin, dan genteng beton. Penurunan dilakukan di titik bongkar yang dapat dijangkau truk.";

    // Ketentuan Minimum & Peringatan
    let minimumBadge = "Layanan Reguler & Proyek";
    let minimumTone: "good" | "mid" | "warn" = "good";
    let minimumAlert: string | null = null;

    if (isProjectZone) {
      minimumBadge = "Khusus Skala Proyek · Min. Order Disepakati";
      minimumTone = volume === "parsial" ? "warn" : "mid";
      minimumAlert =
        volume === "parsial"
          ? `Untuk pengiriman ke ${zoneName}, Istana Block hanya melayani pesanan skala proyek dengan volume minimal yang disepakati per proyek (bukan eceran < 1 truk).`
          : `Pengiriman skala proyek ke ${zoneName} akan dicek minimal order dan penjadwalan ritasenya oleh admin pada penawaran tertulis.`;
    } else if (isConfirmZone) {
      minimumBadge = "Wajib Konfirmasi Jadwal & Rute Admin";
      minimumTone = "mid";
      minimumAlert = isOutsideList
        ? "Kota di luar daftar wilayah reguler wajib dikonfirmasi terlebih dulu bersama admin untuk memastikan jangkauan armada dan jadwal."
        : `Pengiriman ke ${zoneName} memerlukan konfirmasi jadwal armada serta perhitungan ongkir khusus dengan admin sebelum PO.`;
    } else if (isPriority) {
      minimumBadge = "Area Prioritas · Terdekat dari Pabrik";
      minimumTone = "good";
    }

    // Checklist info untuk admin
    const checklist: string[] = [
      `Nama produk, ukuran/tebal, serta perkiraan volume (${volume === "parsial" ? "m² / pcs" : "estimasi jumlah truk atau total m²/pcs/m"}).`,
      `Titik pin lokasi Google Maps di ${zoneName}.`,
      access === "sempit" || unload === "crane"
        ? "Foto lebar jalan masuk, kondisi portal/kabel rendah, dan area parkir untuk proses bongkar."
        : "Konfirmasi posisi titik bongkar agar truk bisa merapat dengan aman.",
    ];

    if (isProjectZone) {
      checklist.push("Nama proyek/instansi untuk konfirmasi ketentuan minimal order skala proyek.");
    } else if (isConfirmZone) {
      checklist.push("Target tanggal kirim agar admin bisa menjadwalkan rute armada jarak menengah/jauh.");
    } else if (volume === "proyek") {
      checklist.push("Permintaan tahapan jadwal pengiriman bila material diturunkan bertahap (multi-truk).");
    }

    const volumeLabel = VOLUME_OPTIONS.find((o) => o.id === volume)?.label ?? volume;
    const accessLabel = ACCESS_OPTIONS.find((o) => o.id === access)?.label ?? access;
    const unloadLabel = UNLOAD_OPTIONS.find((o) => o.id === unload)?.label ?? unload;

    const waMessage = [
      "Halo Istana Block, saya ingin cek ongkir dan perkiraan jadwal kirim.",
      `- Zona tujuan: ${zoneName}`,
      `- Perkiraan muatan: ${volumeLabel}`,
      `- Akses lokasi: ${accessLabel}`,
      `- Kebutuhan bongkar: ${unloadLabel}`,
      "Produk & volume rinci: ...",
      "Titik lokasi peta: ...",
    ].join("\n");

    return {
      meters: [
        { label: "Efisiensi ongkir per unit", score: effScore, status: effStatus, tone: effTone, note: effNote },
        { label: "Kemudahan penjadwalan rute", score: schedScore, status: schedStatus, tone: schedTone, note: schedNote },
        { label: "Kesiapan akses & bongkar", score: accessScore, status: accessStatus, tone: accessTone, note: accessNote },
      ] as MeterItem[],
      fleetTitle,
      fleetDetail,
      minimumBadge,
      minimumTone,
      minimumAlert,
      checklist,
      waHref: waLink(whatsapp, waMessage),
    };
  }, [access, isOutsideList, selectedZone, unload, volume, whatsapp, zoneName]);

  return (
    <div className="area-explorer-stack">
      {/* BAGIAN 1: CARA ONGKIR DIHITUNG (DIAGRAM + SIMULASI) */}
      <section id="cara-ongkir" className="area-section-block" aria-labelledby="judul-ongkir">
        <div className="area-section-head">
          <div>
            <span className="area-eyebrow">Transparansi biaya kirim</span>
            <h2 id="judul-ongkir">Cara ongkir dihitung</h2>
          </div>
          <p className="area-section-lead">
            Ongkir tidak digabung ke harga produk dan selalu ditulis terpisah di penawaran resmi berdasarkan tiga penggerak utama berikut.
          </p>
        </div>

        {/* Diagram Visual Formula Ongkir */}
        <figure className="area-formula-card">
          <div className="area-formula-eq" aria-label="Rumus visual faktor penentu ongkir: Jarak dari Pasawahan ditambah Efisiensi Muatan Truk ditambah Akses Titik Bongkar menghasilkan Penawaran Ongkir Tertulis">
            <div className="area-f-node">
              <div className="area-f-illus" aria-hidden="true">
                <svg viewBox="0 0 180 74" width="180" height="74">
                  <path d="M24 46 C62 18, 116 18, 154 46" fill="none" stroke="#254186" strokeWidth="2.5" strokeDasharray="5 4" />
                  <polygon points="24,33 34,39 34,51 24,57 14,51 14,39" fill="#FE5722" stroke="#ffffff" strokeWidth="2" />
                  <circle cx="154" cy="45" r="9" fill="#254186" stroke="#ffffff" strokeWidth="2" />
                  <circle cx="154" cy="45" r="3" fill="#ffffff" />
                  <line x1="24" y1="64" x2="154" y2="64" stroke="#b5b4af" strokeWidth="1.5" />
                  <path d="M24 60v8M154 60v8" stroke="#b5b4af" strokeWidth="1.5" />
                </svg>
              </div>
              <span className="area-f-num">Faktor 1</span>
              <h3>Jarak dari Pasawahan</h3>
              <p>Dihitung dari pabrik di Pasawahan ke titik bongkar melalui koridor tol atau arteri.</p>
            </div>

            <span className="area-f-op" aria-hidden="true">+</span>

            <div className="area-f-node">
              <div className="area-f-illus" aria-hidden="true">
                <svg viewBox="0 0 180 74" width="180" height="74">
                  <rect x="12" y="14" width="70" height="22" rx="6" fill="#eaeae6" stroke="#b5b4af" strokeWidth="1.5" />
                  <rect x="15" y="17" width="24" height="16" rx="4" fill="#d63f12" />
                  <text x="48" y="29" fontSize="10" fontWeight="700" fill="#4b5568">Parsial</text>
                  <rect x="12" y="42" width="156" height="22" rx="6" fill="#e3e9f5" stroke="#254186" strokeWidth="1.5" />
                  <rect x="15" y="45" width="114" height="16" rx="4" fill="#254186" />
                  <text x="135" y="57" fontSize="10" fontWeight="700" fill="#0e2a6b">Penuh</text>
                </svg>
              </div>
              <span className="area-f-num">Faktor 2</span>
              <h3>Efisiensi Muatan Truk</h3>
              <p>Makin penuh muatan satu truk, makin rendah porsi ongkir per m² atau per pcs.</p>
            </div>

            <span className="area-f-op" aria-hidden="true">+</span>

            <div className="area-f-node">
              <div className="area-f-illus" aria-hidden="true">
                <svg viewBox="0 0 180 74" width="180" height="74">
                  <line x1="18" y1="58" x2="162" y2="58" stroke="#b5b4af" strokeWidth="2" />
                  <rect x="34" y="30" width="54" height="24" rx="4" fill="#254186" />
                  <path d="M88 38h20l10 10v6H88z" fill="#0e2a6b" />
                  <circle cx="48" cy="57" r="6" fill="#14213d" stroke="#ffffff" strokeWidth="2" />
                  <circle cx="104" cy="57" r="6" fill="#14213d" stroke="#ffffff" strokeWidth="2" />
                  <path d="M52 24L84 12L126 24" fill="none" stroke="#FE5722" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="126" y1="24" x2="126" y2="39" stroke="#FE5722" strokeWidth="2" strokeDasharray="3 2" />
                </svg>
              </div>
              <span className="area-f-num">Faktor 3</span>
              <h3>Akses Titik Bongkar</h3>
              <p>Kelancaran truk masuk lokasi dan ruang aman untuk menurunkan material atau crane.</p>
            </div>

            <span className="area-f-op is-eq" aria-hidden="true">=</span>

            <div className="area-f-node is-result">
              <div className="area-f-illus" aria-hidden="true">
                <svg viewBox="0 0 120 74" width="120" height="74">
                  <rect x="24" y="8" width="72" height="58" rx="10" fill="#ffffff" stroke="#FE5722" strokeWidth="2.5" />
                  <line x1="38" y1="24" x2="82" y2="24" stroke="#0e2a6b" strokeWidth="3" strokeLinecap="round" />
                  <line x1="38" y1="36" x2="76" y2="36" stroke="#4b5568" strokeWidth="2.5" strokeLinecap="round" />
                  <rect x="38" y="45" width="44" height="10" rx="5" fill="#ffe6dc" />
                </svg>
              </div>
              <span className="area-f-num is-accent">Hasil</span>
              <h3>Ongkir Tertulis</h3>
              <p>Nominal pasti &amp; jadwal kirim dikirim tertulis oleh admin di penawaran resmi.</p>
            </div>
          </div>

          <figcaption className="area-formula-notes">
            <strong>Ketentuan dasar ongkir:</strong>
            <ul>
              {ongkirRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </figcaption>
        </figure>

        {/* Simulasi Interaktif (Kualitatif — Tanpa Tarif Rupiah Fiktif) */}
        <div id="simulasi-ongkir" className="area-sim-card">
          <div className="area-sim-head">
            <div>
              <span className="area-sim-kicker">Simulasi kualitatif &amp; kesiapan armada</span>
              <h3>Cek kecocokan rute, efisiensi muatan, dan info untuk admin</h3>
            </div>
            <p className="area-sim-disclaimer">
              Simulasi ini memetakan penggerak biaya &amp; kesiapan armada tanpa tarif rupiah perkiraan; nominal resmi dihitung admin sesuai titik peta Anda.
            </p>
          </div>

          <div className="area-sim-grid">
            {/* Kolom Kontrol Input */}
            <div className="area-sim-controls">
              <div className="area-ctrl-group">
                <label htmlFor={zoneSelectId} className="area-ctrl-label">
                  1. Pilih Zona Tujuan
                </label>
                <select
                  id={zoneSelectId}
                  className="area-select"
                  value={zoneId}
                  onChange={(e) => setZoneId(e.target.value)}
                >
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nama} ({r.jarakSingkat})
                    </option>
                  ))}
                  <option value="luar-daftar">Kota lain di luar daftar (konfirmasi admin)</option>
                </select>
              </div>

              <fieldset className="area-ctrl-fieldset">
                <legend className="area-ctrl-label">2. Muatan / Volume Pesanan</legend>
                <div className="area-radio-stack">
                  {VOLUME_OPTIONS.map((opt) => {
                    const checked = volume === opt.id;
                    return (
                      <label key={opt.id} className={`area-radio-card ${checked ? "is-checked" : ""}`}>
                        <input
                          type="radio"
                          name="sim-volume"
                          value={opt.id}
                          checked={checked}
                          onChange={() => setVolume(opt.id)}
                        />
                        <span className="area-radio-content">
                          <span className="area-radio-title">{opt.label}</span>
                          <span className="area-radio-sub">{opt.sub}</span>
                          <span className="area-fill-track" aria-hidden="true">
                            <span className="area-fill-bar" style={{ width: `${opt.fillPct}%` }} />
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="area-ctrl-fieldset">
                <legend className="area-ctrl-label">3. Kondisi Akses Lokasi Bongkar</legend>
                <div className="area-radio-pair">
                  {ACCESS_OPTIONS.map((opt) => {
                    const checked = access === opt.id;
                    return (
                      <label key={opt.id} className={`area-radio-card ${checked ? "is-checked" : ""}`}>
                        <input
                          type="radio"
                          name="sim-access"
                          value={opt.id}
                          checked={checked}
                          onChange={() => setAccess(opt.id)}
                        />
                        <span className="area-radio-content">
                          <span className="area-radio-title">{opt.label}</span>
                          <span className="area-radio-sub">{opt.sub}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="area-ctrl-fieldset">
                <legend className="area-ctrl-label">4. Kebutuhan Bongkar Material</legend>
                <div className="area-radio-pair">
                  {UNLOAD_OPTIONS.map((opt) => {
                    const checked = unload === opt.id;
                    return (
                      <label key={opt.id} className={`area-radio-card ${checked ? "is-checked" : ""}`}>
                        <input
                          type="radio"
                          name="sim-unload"
                          value={opt.id}
                          checked={checked}
                          onChange={() => setUnload(opt.id)}
                        />
                        <span className="area-radio-content">
                          <span className="area-radio-title">{opt.label}</span>
                          <span className="area-radio-sub">{opt.sub}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            {/* Kolom Hasil Diagnostik Live */}
            <div className="area-sim-output" aria-live="polite">
              <div className="area-out-header">
                <div>
                  <span className="area-out-eyebrow">Ringkasan rute tujuan</span>
                  <h4>{zoneName}</h4>
                </div>
                <span className={`area-min-badge is-${simulation.minimumTone}`}>{simulation.minimumBadge}</span>
              </div>

              {simulation.minimumAlert && (
                <div className={`area-out-alert is-${simulation.minimumTone}`} role="note">
                  <strong>Ketentuan zona:</strong> {simulation.minimumAlert}
                </div>
              )}

              {/* Meter Efisiensi Visual */}
              <div className="area-meters">
                {simulation.meters.map((m) => (
                  <div key={m.label} className="area-meter-row">
                    <div className="area-meter-top">
                      <span className="area-meter-label">{m.label}</span>
                      <span className={`area-meter-status is-${m.tone}`}>{m.status}</span>
                    </div>
                    <div
                      className="area-meter-track"
                      role="progressbar"
                      aria-label={m.label}
                      aria-valuenow={m.score}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className={`area-meter-fill is-${m.tone}`} style={{ width: `${m.score}%` }} />
                    </div>
                    <p className="area-meter-note">{m.note}</p>
                  </div>
                ))}
              </div>

              {/* Rekomendasi Armada */}
              <div className="area-fleet-box">
                <div className="area-fleet-icon" aria-hidden="true">
                  {unload === "crane" ? (
                    <svg viewBox="0 0 40 32" width="38" height="30">
                      <rect x="2" y="14" width="22" height="11" rx="2" fill="#254186" />
                      <path d="M24 17h8l5 5v3H24z" fill="#0e2a6b" />
                      <path d="M12 14L23 4l11 7" fill="none" stroke="#FE5722" strokeWidth="2.5" strokeLinecap="round" />
                      <line x1="34" y1="11" x2="34" y2="19" stroke="#FE5722" strokeWidth="2" strokeDasharray="2 2" />
                      <circle cx="9" cy="27" r="3" fill="#14213d" />
                      <circle cx="29" cy="27" r="3" fill="#14213d" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 40 32" width="38" height="30">
                      <rect x="2" y="10" width="23" height="15" rx="2.5" fill="#254186" />
                      <path d="M25 15h7l5 5v5H25z" fill="#0e2a6b" />
                      <circle cx="9" cy="27" r="3" fill="#14213d" />
                      <circle cx="29" cy="27" r="3" fill="#14213d" />
                    </svg>
                  )}
                </div>
                <div>
                  <span className="area-fleet-kicker">Armada yang direkomendasikan</span>
                  <strong>{simulation.fleetTitle}</strong>
                  <p>{simulation.fleetDetail}</p>
                </div>
              </div>

              {/* Daftar Checklist Info untuk Admin */}
              <div className="area-checklist-box">
                <h5>Checklist info untuk dikirim ke admin</h5>
                <ul>
                  {simulation.checklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="area-out-cta">
                <a className="btn btn-primary area-sim-wa" href={simulation.waHref} target="_blank" rel="noopener">
                  Hitung ongkir ini via WhatsApp
                </a>
                {selectedZone?.slug && selectedZone.isLiveSlug && (
                  <Link href={`/${selectedZone.slug}`} className="btn btn-ghost btn-sm">
                    Info area {selectedZone.nama} →
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BAGIAN 2: CARA MEMESAN (FLOW DIAGRAM 5 LANGKAH) */}
      <section id="cara-memesan" className="area-section-block" aria-labelledby="judul-pesan">
        <div className="area-section-head">
          <div>
            <span className="area-eyebrow">Alur pemesanan resmi</span>
            <h2 id="judul-pesan">Cara memesan (5 langkah)</h2>
          </div>
          <p className="area-section-lead">
            Dari menentukan perkiraan volume hingga pelunasan saat armada tiba di lokasi bongkar.
          </p>
        </div>

        <ol className="area-flow-list">
          {orderSteps.slice(0, 5).map((stepText, idx) => {
            const meta = STEP_META[idx] ?? STEP_META[0];
            return (
              <li key={meta.deliverable} className="area-flow-step">
                <div className="area-flow-top">
                  <span className="area-flow-num hex" aria-hidden="true">
                    {idx + 1}
                  </span>
                  <span className="area-flow-icon" aria-hidden="true">
                    <StepIcon kind={meta.icon} />
                  </span>
                </div>
                <span className="area-flow-deliverable">{meta.deliverable}</span>
                <h3>{meta.title}</h3>
                <p className="area-flow-text">{stepText}</p>
                <span className="area-flow-hint">{meta.hint}</span>
              </li>
            );
          })}
        </ol>

        <div className="area-milestone-strip" role="note" aria-label="Ringkasan alur pembayaran dan konfirmasi jadwal">
          <div className="area-ms-item">
            <span className="area-ms-tag">Saat setuju penawaran</span>
            <strong>Terbitkan PO &amp; bayar DP</strong>
          </div>
          <span className="area-ms-arrow" aria-hidden="true">→</span>
          <div className="area-ms-item">
            <span className="area-ms-tag">Persiapan pabrik</span>
            <strong>Admin mengonfirmasi jadwal kirim armada</strong>
          </div>
          <span className="area-ms-arrow" aria-hidden="true">→</span>
          <div className="area-ms-item">
            <span className="area-ms-tag">Serah terima proyek</span>
            <strong>Pelunasan saat barang tiba di lokasi</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
