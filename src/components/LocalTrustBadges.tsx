import { Hex } from "./Hex";

export function LocalTrustBadges({ areaName }: { areaName: string }) {
  return (
    <section className="local-trust-wrap" aria-label={`Jaminan Layanan Pabrik untuk Wilayah ${areaName}`}>
      <div className="local-trust-grid">
        <div className="local-trust-card">
          <div className="local-trust-icon" style={{ background: "#ecfdf5", color: "#059669" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <div>
            <strong>Garansi Ganti Barang Pecah</strong>
            <p>Paving retak atau pecah saat penurunan di lokasi proyek diganti langsung tanpa debat.</p>
          </div>
        </div>

        <div className="local-trust-card">
          <div className="local-trust-icon" style={{ background: "#fffbeb", color: "#d97706" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </div>
          <div>
            <strong>Armada Truk Crane Sendiri</strong>
            <p>Bongkar muat hidrolik mandiri, palet tersusun rapi, hemat biaya kuli bongkar di lokasi.</p>
          </div>
        </div>

        <div className="local-trust-card">
          <div className="local-trust-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <div>
            <strong>TKDN Kemenperin &amp; Mutu K-450</strong>
            <p>Tersertifikasi TKDN resmi Kemenperin &amp; uji kuat tekan lab, legal untuk tender proyek.</p>
          </div>
        </div>

        <div className="local-trust-card">
          <div className="local-trust-icon" style={{ background: "#fdf2f8", color: "#db2777" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div>
            <strong>Kunjungan Fisik ke Pabrik</strong>
            <p>Boleh datang langsung cek mesin cetak press dan stok barang di Pasawahan sebelum bayar.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
