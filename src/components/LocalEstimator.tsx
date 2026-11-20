"use client";

import { useId, useMemo, useState } from "react";
import { waLink } from "@/lib/format";
import { hitungArmada } from "@/lib/paving/kebutuhan/armada";

type ProductOption = {
  id: string;
  nama: string;
  tebal: string;
  mutu: string;
  pcsPerM2: number;
  kegunaan: string;
};

const PRODUCTS: ProductOption[] = [
  { id: "truepave-6", nama: "Truepave (Bata)", tebal: "6 cm", mutu: "K-350", pcsPerM2: 44, kegunaan: "Carport, halaman rumah & trotoar" },
  { id: "truepave-8", nama: "Truepave (Bata)", tebal: "8 cm", mutu: "K-400+", pcsPerM2: 44, kegunaan: "Jalan lingkungan, ruko & akses truk" },
  { id: "hexagon-6", nama: "Hexagon (Segi Enam)", tebal: "6 cm", mutu: "K-350", pcsPerM2: 25, kegunaan: "Taman publik, plaza & estetika arsitektur" },
  { id: "grassblock-8", nama: "Grass Block (Rumput)", tebal: "8 cm", mutu: "K-350", pcsPerM2: 8.3, kegunaan: "Resapan air, area parkir hijau & villa" },
];

type Props = {
  areaName: string;
  districts?: string[];
  whatsapp: string;
};

export function LocalEstimator({ areaName, districts = [], whatsapp }: Props) {
  const [selectedDistrict, setSelectedDistrict] = useState(districts[0] || areaName);
  const [selectedProduct, setSelectedProduct] = useState(PRODUCTS[0].id);
  const [areaM2, setAreaM2] = useState(100);

  const product = useMemo(
    () => PRODUCTS.find((p) => p.id === selectedProduct) ?? PRODUCTS[0],
    [selectedProduct],
  );

  const totalPcs = useMemo(
    () => Math.round(areaM2 * product.pcsPerM2),
    [areaM2, product.pcsPerM2],
  );

  const truckInfo = useMemo(() => {
    const armada = hitungArmada(areaM2);
    if (armada.jenis === "colt-diesel") {
      return { type: "1 Rit Truk Colt Diesel", desc: "Akses fleksibel ke jalan pemukiman & gang lebar." };
    }
    if (armada.rit === 1) {
      return { type: "1 Rit Truk Fuso Crane", desc: "Bongkar muat hidrolik mandiri, palet utuh tanpa kuli." };
    }
    return { type: `${armada.rit} Rit Armada Truk Crane`, desc: "Pengiriman terjadwal bertahap sesuai progres di proyek." };
  }, [areaM2]);

  const waText = useMemo(() => {
    const loc = selectedDistrict !== areaName ? `${selectedDistrict}, ${areaName}` : areaName;
    return `Halo Istana Block, saya ingin minta penawaran resmi untuk proyek di ${loc}:\n• Produk: ${product.nama} ${product.tebal} (${product.mutu})\n• Kebutuhan: ${areaM2} m² (±${totalPcs.toLocaleString("id-ID")} pcs)\n• Armada: ${truckInfo.type}\nMohon info ketersediaan stok, harga pabrik, dan estimasi ongkir ke lokasi. Terima kasih.`;
  }, [selectedDistrict, areaName, product, areaM2, totalPcs, truckInfo.type]);

  const waHref = waLink(whatsapp, waText);
  const sliderId = useId();

  return (
    <section className="local-estimator-box panel hexpat" aria-labelledby="estimator-heading">
      <div className="local-estimator-header">
        <span className="pill pill-orange">Kalkulator Kebutuhan &amp; Logistik</span>
        <h2 id="estimator-heading" style={{ fontSize: "clamp(20px, 3vw, 24px)", margin: "4px 0" }}>
          Simulasi Kebutuhan &amp; Armada Kirim ke {areaName}
        </h2>
        <p className="small muted">
          Hitung estimasi jumlah keping paving dan rekomendasi kapasitas armada truk crane langsung dari pabrik Pasawahan.
        </p>
      </div>

      <div className="local-estimator-grid">
        <div className="local-estimator-inputs">
          {districts.length > 0 && (
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: "0.85rem", display: "block", marginBottom: 6 }}>
                Titik Kecamatan / Wilayah Proyek:
              </label>
              <div className="local-district-chips">
                {districts.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`district-chip ${selectedDistrict === d ? "is-active" : ""}`}
                    onClick={() => setSelectedDistrict(d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: "0.85rem", display: "block", marginBottom: 6 }}>
              Pilihan Jenis &amp; Mutu Paving:
            </label>
            <div className="local-product-picker">
              {PRODUCTS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`product-picker-btn ${selectedProduct === p.id ? "is-selected" : ""}`}
                  onClick={() => setSelectedProduct(p.id)}
                >
                  <div className="prod-name">
                    <strong>{p.nama}</strong> <span className="prod-thick">{p.tebal}</span>
                  </div>
                  <div className="prod-meta">
                    <span className="badge-mutu">{p.mutu}</span>
                    <span className="prod-use">{p.kegunaan}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <label htmlFor={sliderId} style={{ fontWeight: 700, fontSize: "0.85rem" }}>
                Estimasi Luas Area:
              </label>
              <div className="area-value-display">
                <strong>{areaM2}</strong> <span className="muted">m²</span>
              </div>
            </div>
            <input
              id={sliderId}
              type="range"
              min={20}
              max={1000}
              step={10}
              value={areaM2}
              onChange={(e) => setAreaM2(Number(e.target.value))}
              className="local-slider"
            />
            <div className="slider-markers">
              <span onClick={() => setAreaM2(50)}>50 m² (Rumah)</span>
              <span onClick={() => setAreaM2(200)}>200 m² (Ruko/Jalan)</span>
              <span onClick={() => setAreaM2(500)}>500 m² (Gudang/Pabrik)</span>
            </div>
          </div>
        </div>

        <div className="local-estimator-summary">
          <div className="summary-card">
            <div className="summary-head">
              <span className="summary-eyebrow">Estimasi untuk {selectedDistrict}</span>
              <h3>Hasil Perhitungan Cepat</h3>
            </div>

            <div className="summary-stat-grid">
              <div className="stat-card">
                <span className="stat-label">Total Kebutuhan Material</span>
                <div className="stat-number">
                  ±{totalPcs.toLocaleString("id-ID")} <span className="unit">pcs</span>
                </div>
                <span className="stat-sub">({product.pcsPerM2} pcs per m²)</span>
              </div>

              <div className="stat-card">
                <span className="stat-label">Rekomendasi Armada Kirim</span>
                <div className="stat-number" style={{ fontSize: "1.05rem", color: "#0f172a" }}>
                  {truckInfo.type}
                </div>
                <span className="stat-sub">{truckInfo.desc}</span>
              </div>
            </div>

            <div className="summary-dispatch-note">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
                <circle cx="12" cy="12" r="10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <span>
                Pengiriman langsung dari Pabrik Pasawahan, Purwakarta. Penurunan palet menggunakan sistem crane hidrolik otomatis.
              </span>
            </div>

            <a
              href={waHref}
              target="_blank"
              rel="noopener"
              className="btn btn-primary btn-block-wa"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 16px", textDecoration: "none" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.969.586 1.771.867 2.802.867 3.18 0 5.766-2.587 5.767-5.766.001-3.187-2.575-5.754-5.773-5.754zm4.17 7.625c-.173.486-.888.894-1.233.951-.345.058-.788.106-2.285-.516-1.785-.742-2.915-2.589-3.003-2.709-.088-.12-1.393-1.854-1.393-3.535 0-1.681.879-2.511 1.192-2.857.313-.346.684-.432.913-.432.228 0 .456.002.656.012.211.011.493-.08.77.587.287.694.975 2.378 1.06 2.551.086.173.143.375.029.605-.114.23-.172.374-.343.576-.172.202-.365.45-.522.604-.173.173-.353.361-.152.707.201.345.894 1.474 1.919 2.387 1.319 1.174 2.43 1.537 2.776 1.71.346.173.548.144.75-.087.202-.231.867-1.009 1.1-1.355.23-.346.462-.288.773-.173.313.115 1.979.933 2.319 1.104.34.172.569.258.654.402.086.144.086.837-.087 1.323z" />
              </svg>
              <span>Minta Penawaran Resmi ke {selectedDistrict}</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
