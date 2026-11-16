type TkdnValues = {
  paving?: string | null;
  uditch?: string | null;
  buis?: string | null;
};

/**
 * Diagram Arsitektur Pengadaan 1 Pintu (/paket-proyek).
 * Menampilkan 3 lini material pabrik yang bertemu di hub penawaran & armada tunggal,
 * lalu dikirim ke lokasi proyek (dengan cabang opsional jasa pasang paving).
 * Menyediakan viewBox lanskap untuk desktop/tablet dan viewBox vertikal untuk ponsel
 * agar tipografi tetap tajam dan terbaca tanpa mengecil atau terpotong.
 */
export function PaketSatuPintuDiagram({ tkdn }: { tkdn?: TkdnValues }) {
  const pavingTkdn = tkdn?.paving || "91,58";
  const uditchTkdn = tkdn?.uditch || "78,61";
  const buisTkdn = tkdn?.buis || "100";

  return (
    <figure className="paket-figure">
      {/* ViewBox lanskap untuk desktop & tablet (>= 760px) */}
      <svg
        className="paket-svg-desktop"
        viewBox="0 0 1060 468"
        role="img"
        aria-labelledby="paket-satu-pintu-title paket-satu-pintu-desc"
        style={{ fontFamily: "var(--font-isi)" }}
      >
        <title id="paket-satu-pintu-title">
          Arsitektur Pengadaan Paket Material Proyek Satu Pintu Istana Block
        </title>
        <desc id="paket-satu-pintu-desc">
          Tiga lini material pabrik — Akses &amp; Perkerasan (Paving Block TKDN {pavingTkdn}% dan Kanstin),
          Drainase &amp; Gorong (U-Ditch TKDN {uditchTkdn}%, Buis Beton TKDN {buisTkdn}%, dan Gravel (Greffel)), serta Atap Proyek
          (Genteng Beton Garuda dan Flat beserta aksesoris) — dikonsolidasikan menjadi satu penawaran tertulis,
          berkas TKDN Kemenperin, dan satu jadwal armada truk crane dan flatbed menuju lokasi proyek,
          dengan opsi cabang jasa pasang paving minimal 200 m² dan survei gratis.
        </desc>

        <defs>
          <pattern id="paket-bp-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#254186" strokeOpacity="0.045" strokeWidth="1" />
          </pattern>
          <marker id="paket-arrow-biru" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
            <path d="M 1 1.5 L 8.5 5 L 1 8.5 z" fill="#254186" />
          </marker>
          <marker id="paket-arrow-oranye" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 1 1.5 L 8.5 5 L 1 8.5 z" fill="#fe5722" />
          </marker>
          <marker id="paket-arrow-garis" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
            <path d="M 1 1.5 L 8.5 5 L 1 8.5 z" fill="#4d66a8" />
          </marker>
        </defs>

        {/* Latar blueprint halus */}
        <rect x="0" y="0" width="1060" height="468" rx="20" fill="#fbfcfd" />
        <rect x="0" y="0" width="1060" height="468" rx="20" fill="url(#paket-bp-grid)" />

        {/* Callout bernomor ① ② ③ di rel atas */}
        <g>
          <path d="M 32 37 V 52" stroke="#4d66a8" strokeWidth="1.5" />
          <circle cx="32" cy="26" r="11" fill="#254186" />
          <text x="32" y="30" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="700" style={{ fontFamily: "var(--font-judul)", fontVariantNumeric: "tabular-nums" }}>
            1
          </text>
          <text x="51" y="30" fill="#0e2a6b" fontSize="11.5" fontWeight="700" letterSpacing="0.06em">
            3 LINI MATERIAL PABRIK
          </text>

          <path d="M 426 37 V 92" stroke="#d63f12" strokeWidth="1.5" />
          <circle cx="426" cy="26" r="11" fill="#d63f12" />
          <text x="426" y="30" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="700" style={{ fontFamily: "var(--font-judul)", fontVariantNumeric: "tabular-nums" }}>
            2
          </text>
          <text x="445" y="30" fill="#0e2a6b" fontSize="11.5" fontWeight="700" letterSpacing="0.06em">
            KONSOLIDASI 1 PINTU
          </text>

          <path d="M 796 37 V 108" stroke="#0e2a6b" strokeWidth="1.5" />
          <circle cx="796" cy="26" r="11" fill="#0e2a6b" />
          <text x="796" y="30" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="700" style={{ fontFamily: "var(--font-judul)", fontVariantNumeric: "tabular-nums" }}>
            3
          </text>
          <text x="815" y="30" fill="#0e2a6b" fontSize="11.5" fontWeight="700" letterSpacing="0.06em">
            KIRIM &amp; PASANG LOKASI
          </text>
        </g>

        {/* Zona common-region kolom kiri: 3 lini material */}
        <rect
          x="18"
          y="52"
          width="340"
          height="394"
          rx="18"
          fill="#e3e9f5"
          fillOpacity="0.28"
          stroke="#4d66a8"
          strokeWidth="1.25"
          strokeDasharray="6 4"
        />

        {/* Konektor ortogonal: Lini -> Center Hub */}
        <g fill="none" stroke="#254186" strokeWidth="2">
          <path d="M 344 124 H 382 V 206 H 401" markerEnd="url(#paket-arrow-biru)" />
          <path d="M 344 252 H 401" markerEnd="url(#paket-arrow-biru)" />
          <path d="M 344 377 H 382 V 298 H 401" markerEnd="url(#paket-arrow-biru)" />
        </g>

        {/* Konektor ortogonal: Center Hub -> Lokasi Proyek & Cabang Opsional */}
        <g>
          <path d="M 680 186 H 770" fill="none" stroke="#fe5722" strokeWidth="2.5" markerEnd="url(#paket-arrow-oranye)" />
          <text x="729" y="175" textAnchor="middle" fill="#b8350e" fontSize="11.5" fontWeight="700">
            Armada sendiri
          </text>

          <path
            d="M 680 302 H 724 V 364 H 770"
            fill="none"
            stroke="#4d66a8"
            strokeWidth="1.75"
            strokeDasharray="5 4"
            markerEnd="url(#paket-arrow-garis)"
          />
          <text x="702" y="291" textAnchor="middle" fill="#4b5568" fontSize="11" fontWeight="600">
            Opsional
          </text>
        </g>

        {/* Lini 1: Akses & Perkerasan */}
        <g className="paket-svg-link-node">
          <rect x="32" y="68" width="312" height="112" rx="14" fill="#ffffff" stroke="#c5d0e6" strokeWidth="1.5" />
          <text x="48" y="90" fill="#254186" fontSize="11" fontWeight="700" letterSpacing="0.06em">
            AKSES &amp; PERKERASAN
          </text>
          <text x="48" y="114" fill="#0e2a6b" fontSize="15.5" fontWeight="700" style={{ fontFamily: "var(--font-judul)" }}>
            Paving Block &amp; Kanstin
          </text>
          <text x="48" y="134" fill="#3e4a63" fontSize="12" style={{ fontVariantNumeric: "tabular-nums" }}>
            Mutu K-350–K-450 · Tebal 6 &amp; 8 cm
          </text>
          <rect x="48" y="146" width="114" height="22" rx="11" fill="#ffe6dc" />
          <text x="105" y="161" textAnchor="middle" fill="#b8350e" fontSize="11.5" fontWeight="700" style={{ fontVariantNumeric: "tabular-nums" }}>
            TKDN {pavingTkdn}%
          </text>
          <rect x="170" y="146" width="124" height="22" rx="11" fill="#f1f1ee" />
          <text x="232" y="161" textAnchor="middle" fill="#3e4a63" fontSize="11" fontWeight="600">
            Kanstin S / KS / DKI
          </text>
        </g>

        {/* Lini 2: Drainase & Gorong */}
        <g className="paket-svg-link-node">
          <rect x="32" y="190" width="312" height="124" rx="14" fill="#ffffff" stroke="#c5d0e6" strokeWidth="1.5" />
          <text x="48" y="210" fill="#254186" fontSize="11" fontWeight="700" letterSpacing="0.06em">
            DRAINASE &amp; GORONG
          </text>
          <text x="48" y="231" fill="#0e2a6b" fontSize="15.5" fontWeight="700" style={{ fontFamily: "var(--font-judul)" }}>
            U-Ditch · Buis Beton ·
            <tspan x="48" dy="19">
              Gravel (Greffel)
            </tspan>
          </text>
          <text x="48" y="269" fill="#3e4a63" fontSize="12">
            Saluran pracetak, cover &amp; gorong
          </text>
          <rect x="48" y="280" width="136" height="22" rx="11" fill="#e3e9f5" />
          <text x="116" y="295" textAnchor="middle" fill="#0e2a6b" fontSize="11.5" fontWeight="700" style={{ fontVariantNumeric: "tabular-nums" }}>
            U-Ditch TKDN {uditchTkdn}%
          </text>
          <rect x="192" y="280" width="122" height="22" rx="11" fill="#e4f3ea" />
          <text x="253" y="295" textAnchor="middle" fill="#1d6b3a" fontSize="11.5" fontWeight="700" style={{ fontVariantNumeric: "tabular-nums" }}>
            Buis TKDN {buisTkdn}%
          </text>
        </g>

        {/* Lini 3: Atap Proyek */}
        <g className="paket-svg-link-node">
          <rect x="32" y="324" width="312" height="106" rx="14" fill="#ffffff" stroke="#c5d0e6" strokeWidth="1.5" />
          <text x="48" y="346" fill="#254186" fontSize="11" fontWeight="700" letterSpacing="0.06em">
            ATAP PROYEK
          </text>
          <text x="48" y="370" fill="#0e2a6b" fontSize="15.5" fontWeight="700" style={{ fontFamily: "var(--font-judul)" }}>
            Genteng Beton Garuda / Flat
          </text>
          <text x="48" y="390" fill="#3e4a63" fontSize="12">
            Lengkap nok, starter, triway &amp; lisplang
          </text>
          <rect x="48" y="400" width="146" height="20" rx="10" fill="#f1f1ee" />
          <text x="121" y="414" textAnchor="middle" fill="#3e4a63" fontSize="11" fontWeight="600">
            Genteng + Aksesoris
          </text>
        </g>

        {/* Center Hub: Konsolidasi 1 Pintu (Anchor Visual Utama) */}
        <g>
          <rect x="408" y="92" width="272" height="300" rx="18" fill="#0e2a6b" stroke="#254186" strokeWidth="1.5" />
          <rect x="428" y="112" width="144" height="24" rx="12" fill="#d63f12" />
          <text x="500" y="128" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="700" letterSpacing="0.05em">
            1 PINTU PENGADAAN
          </text>
          <text x="428" y="162" fill="#ffffff" fontSize="18.5" fontWeight="700" style={{ fontFamily: "var(--font-judul)" }}>
            Konsolidasi Proyek
          </text>
          <text x="428" y="182" fill="#c8d6f0" fontSize="12">
            Seluruh material diproses serentak
          </text>

          <line x1="428" y1="198" x2="660" y2="198" stroke="#ffffff" strokeOpacity="0.18" />
          <polygon points="434,207 440,210.5 440,217.5 434,221 428,217.5 428,210.5" fill="#fe5722" />
          <text x="448" y="218" fill="#ffffff" fontSize="13.5" fontWeight="700">
            1 Penawaran Tertulis
          </text>
          <text x="448" y="236" fill="#cbd7ef" fontSize="11.5">
            Harga pabrik, ongkir &amp; jadwal rinci
          </text>

          <line x1="428" y1="254" x2="660" y2="254" stroke="#ffffff" strokeOpacity="0.18" />
          <polygon points="434,263 440,266.5 440,273.5 434,277 428,273.5 428,266.5" fill="#ffb59a" />
          <text x="448" y="274" fill="#ffffff" fontSize="13.5" fontWeight="700">
            Berkas TKDN Kemenperin
          </text>
          <text x="448" y="292" fill="#cbd7ef" fontSize="11.5">
            Salinan resmi siap lampiran tender
          </text>

          <line x1="428" y1="310" x2="660" y2="310" stroke="#ffffff" strokeOpacity="0.18" />
          <polygon points="434,319 440,322.5 440,329.5 434,333 428,329.5 428,322.5" fill="#8fb0ff" />
          <text x="448" y="330" fill="#ffffff" fontSize="13.5" fontWeight="700">
            1 Jadwal Armada Pabrik
          </text>
          <text x="448" y="348" fill="#cbd7ef" fontSize="11.5">
            Truk crane &amp; truk flatbed sendiri
          </text>

          <text x="428" y="375" fill="#ffb59a" fontSize="11" fontWeight="600">
            1 PIC Admin · Pasawahan, Purwakarta
          </text>
        </g>

        {/* Kolom Kanan Atas: Dikirim ke Lokasi Proyek */}
        <g>
          <rect x="778" y="108" width="264" height="156" rx="16" fill="#ffffff" stroke="#254186" strokeWidth="1.75" />
          <text x="796" y="132" fill="#254186" fontSize="11" fontWeight="700" letterSpacing="0.06em">
            TITIK SERAH TERIMA
          </text>
          <text x="796" y="156" fill="#0e2a6b" fontSize="16" fontWeight="700" style={{ fontFamily: "var(--font-judul)" }}>
            Dikirim ke Lokasi Proyek
          </text>
          <text x="796" y="180" fill="#3e4a63" fontSize="12">
            Purwakarta, Jabar &amp; Jabodetabek*
          </text>
          <text x="796" y="198" fill="#3e4a63" fontSize="12">
            Bongkar truk crane / flatbed
          </text>
          <rect x="796" y="216" width="160" height="24" rx="12" fill="#e3e9f5" />
          <text x="876" y="232" textAnchor="middle" fill="#0e2a6b" fontSize="11.5" fontWeight="700">
            Pelunasan saat tiba
          </text>
        </g>

        {/* Kolom Kanan Bawah: Cabang Opsional Jasa Pasang */}
        <g>
          <rect
            x="778"
            y="296"
            width="264"
            height="136"
            rx="16"
            fill="#ffffff"
            stroke="#fe5722"
            strokeWidth="1.5"
            strokeDasharray="6 4"
          />
          <rect x="796" y="314" width="174" height="22" rx="11" fill="#ffe6dc" />
          <text x="883" y="329" textAnchor="middle" fill="#b8350e" fontSize="10.5" fontWeight="700" letterSpacing="0.04em">
            OPSIONAL · JASA PASANG
          </text>
          <text x="796" y="358" fill="#0e2a6b" fontSize="15.5" fontWeight="700" style={{ fontFamily: "var(--font-judul)" }}>
            Pasang Paving Lokasi
          </text>
          <text x="796" y="380" fill="#14213d" fontSize="12.5" fontWeight="600" style={{ fontVariantNumeric: "tabular-nums" }}>
            Min. 200 m² · Survei Gratis
          </text>
          <text x="796" y="400" fill="#4b5568" fontSize="11.5">
            Garansi 1 bln · Galian terpisah
          </text>
        </g>
      </svg>

      {/* ViewBox vertikal khusus layar sempit (< 760px) agar teks tetap 12-15px terbaca */}
      <svg
        className="paket-svg-mobile"
        viewBox="0 0 360 782"
        aria-hidden="true"
        style={{ fontFamily: "var(--font-isi)" }}
      >
        <defs>
          <marker id="paket-m-biru" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
            <path d="M 1 1.5 L 8.5 5 L 1 8.5 z" fill="#254186" />
          </marker>
          <marker id="paket-m-oranye" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 1 1.5 L 8.5 5 L 1 8.5 z" fill="#fe5722" />
          </marker>
          <marker id="paket-m-garis" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
            <path d="M 1 1.5 L 8.5 5 L 1 8.5 z" fill="#4d66a8" />
          </marker>
        </defs>

        <rect x="0" y="0" width="360" height="782" rx="18" fill="#fbfcfd" />

        {/* Tahap 1: 3 Lini Material */}
        <circle cx="28" cy="26" r="11" fill="#254186" />
        <text x="28" y="30" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="700" style={{ fontFamily: "var(--font-judul)" }}>
          1
        </text>
        <text x="46" y="30" fill="#0e2a6b" fontSize="11.5" fontWeight="700" letterSpacing="0.05em">
          3 LINI MATERIAL PABRIK
        </text>

        <rect x="14" y="44" width="332" height="288" rx="16" fill="#e3e9f5" fillOpacity="0.28" stroke="#4d66a8" strokeWidth="1.25" strokeDasharray="6 4" />

        <rect x="24" y="56" width="312" height="76" rx="12" fill="#ffffff" stroke="#c5d0e6" strokeWidth="1.25" />
        <text x="38" y="76" fill="#254186" fontSize="10.5" fontWeight="700" letterSpacing="0.05em">
          AKSES &amp; PERKERASAN
        </text>
        <text x="38" y="96" fill="#0e2a6b" fontSize="14.5" fontWeight="700" style={{ fontFamily: "var(--font-judul)" }}>
          Paving Block &amp; Kanstin
        </text>
        <rect x="38" y="104" width="102" height="20" rx="10" fill="#ffe6dc" />
        <text x="89" y="118" textAnchor="middle" fill="#b8350e" fontSize="11" fontWeight="700" style={{ fontVariantNumeric: "tabular-nums" }}>
          TKDN {pavingTkdn}%
        </text>
        <text x="148" y="118" fill="#4b5568" fontSize="10.5">
          K-350–K-450 · Kanstin S/KS/DKI
        </text>

        <rect x="24" y="142" width="312" height="94" rx="12" fill="#ffffff" stroke="#c5d0e6" strokeWidth="1.25" />
        <text x="38" y="162" fill="#254186" fontSize="10.5" fontWeight="700" letterSpacing="0.05em">
          DRAINASE &amp; GORONG
        </text>
        <text x="38" y="182" fill="#0e2a6b" fontSize="14.5" fontWeight="700" style={{ fontFamily: "var(--font-judul)" }}>
          U-Ditch · Buis Beton ·
          <tspan x="38" dy="18">
            Gravel (Greffel)
          </tspan>
        </text>
        <rect x="38" y="208" width="128" height="20" rx="10" fill="#e3e9f5" />
        <text x="102" y="222" textAnchor="middle" fill="#0e2a6b" fontSize="11" fontWeight="700" style={{ fontVariantNumeric: "tabular-nums" }}>
          U-Ditch {uditchTkdn}%
        </text>
        <rect x="172" y="208" width="108" height="20" rx="10" fill="#e4f3ea" />
        <text x="226" y="222" textAnchor="middle" fill="#1d6b3a" fontSize="11" fontWeight="700" style={{ fontVariantNumeric: "tabular-nums" }}>
          Buis {buisTkdn}%
        </text>

        <rect x="24" y="246" width="312" height="74" rx="12" fill="#ffffff" stroke="#c5d0e6" strokeWidth="1.25" />
        <text x="38" y="266" fill="#254186" fontSize="10.5" fontWeight="700" letterSpacing="0.05em">
          ATAP PROYEK
        </text>
        <text x="38" y="286" fill="#0e2a6b" fontSize="14.5" fontWeight="700" style={{ fontFamily: "var(--font-judul)" }}>
          Genteng Beton Garuda / Flat
        </text>
        <text x="38" y="306" fill="#4b5568" fontSize="11.5">
          Lengkap nok, starter, triway &amp; lisplang
        </text>

        {/* Panah Turun 1 */}
        <path d="M 180 332 V 372" fill="none" stroke="#254186" strokeWidth="2" markerEnd="url(#paket-m-biru)" />
        <text x="192" y="358" fill="#254186" fontSize="11.5" fontWeight="700">
          Digabung 1 pintu
        </text>

        {/* Tahap 2: Hub 1 Pintu */}
        <rect x="14" y="380" width="332" height="150" rx="16" fill="#0e2a6b" />
        <circle cx="34" cy="402" r="10" fill="#fe5722" />
        <text x="34" y="406" textAnchor="middle" fill="#ffffff" fontSize="11.5" fontWeight="700" style={{ fontFamily: "var(--font-judul)" }}>
          2
        </text>
        <text x="52" y="406" fill="#ffb59a" fontSize="11.5" fontWeight="700" letterSpacing="0.05em">
          KONSOLIDASI 1 PINTU
        </text>
        <text x="28" y="436" fill="#ffffff" fontSize="13.5" fontWeight="700">
          • 1 Penawaran Tertulis (Harga + Ongkir)
        </text>
        <text x="28" y="462" fill="#dbe5f8" fontSize="12.5">
          • Berkas TKDN Kemenperin (Siap Tender)
        </text>
        <text x="28" y="488" fill="#dbe5f8" fontSize="12.5">
          • 1 Jadwal Armada Crane &amp; Flatbed
        </text>
        <text x="28" y="513" fill="#ffb59a" fontSize="11.5" fontWeight="600">
          1 PIC Admin · Pasawahan, Purwakarta
        </text>

        {/* Panah Turun 2 */}
        <path d="M 180 530 V 568" fill="none" stroke="#fe5722" strokeWidth="2.5" markerEnd="url(#paket-m-oranye)" />
        <text x="192" y="555" fill="#b8350e" fontSize="11.5" fontWeight="700">
          Armada sendiri
        </text>

        {/* Tahap 3: Lokasi Proyek + Opsional Pasang */}
        <rect x="14" y="576" width="332" height="86" rx="14" fill="#ffffff" stroke="#254186" strokeWidth="1.75" />
        <circle cx="34" cy="598" r="10" fill="#0e2a6b" />
        <text x="34" y="602" textAnchor="middle" fill="#ffffff" fontSize="11.5" fontWeight="700" style={{ fontFamily: "var(--font-judul)" }}>
          3
        </text>
        <text x="52" y="602" fill="#0e2a6b" fontSize="14.5" fontWeight="700" style={{ fontFamily: "var(--font-judul)" }}>
          Dikirim ke Lokasi Proyek
        </text>
        <text x="28" y="624" fill="#3e4a63" fontSize="12">
          Purwakarta, Jabar &amp; Jabodetabek*
        </text>
        <text x="28" y="644" fill="#0e2a6b" fontSize="11.5" fontWeight="700">
          Pelunasan saat tiba · Crane / flatbed
        </text>

        <path d="M 180 662 V 682" fill="none" stroke="#4d66a8" strokeWidth="1.5" strokeDasharray="4 3" markerEnd="url(#paket-m-garis)" />

        <rect x="14" y="688" width="332" height="80" rx="14" fill="#ffffff" stroke="#fe5722" strokeWidth="1.5" strokeDasharray="6 4" />
        <text x="28" y="710" fill="#b8350e" fontSize="10.5" fontWeight="700" letterSpacing="0.04em">
          OPSIONAL · JASA PASANG PAVING
        </text>
        <text x="28" y="732" fill="#0e2a6b" fontSize="13.5" fontWeight="700" style={{ fontVariantNumeric: "tabular-nums" }}>
          Min. 200 m² · Survei Lokasi Gratis
        </text>
        <text x="28" y="752" fill="#4b5568" fontSize="11.5">
          Garansi 1 bln · Galian &amp; kupas terpisah
        </text>
      </svg>

      <figcaption className="paket-figure-caption">
        <span>
          Seluruh lini material sipil digabung dalam satu penawaran tertulis, berkas TKDN, dan jadwal armada pabrik.
          <span className="muted"> (*Jabodetabek khusus pesanan skala proyek).</span>
        </span>
        <ol className="paket-callout-legend">
          <li>
            <span className="paket-callout-num" aria-hidden="true">1</span>
            Pilih kombinasi lini material
          </li>
          <li>
            <span className="paket-callout-num is-hub" aria-hidden="true">2</span>
            Konsolidasi 1 penawaran &amp; TKDN
          </li>
          <li>
            <span className="paket-callout-num is-out" aria-hidden="true">3</span>
            Kirim lokasi + opsi pasang
          </li>
        </ol>
      </figcaption>
    </figure>
  );
}

type AlurStepMeta = {
  title: string;
  phase: string;
  variant: "base" | "optional" | "anchor" | "install";
  chips: { label: string; tone?: "default" | "accent" | "blue" }[];
};

const ALUR_META: AlurStepMeta[] = [
  {
    title: "Kirim BoQ / Gambar",
    phase: "Pra-order",
    variant: "base",
    chips: [{ label: "Input WhatsApp" }],
  },
  {
    title: "Penawaran + Ongkir",
    phase: "Pra-order",
    variant: "base",
    chips: [{ label: "Dokumen tertulis", tone: "accent" }],
  },
  {
    title: "Kunjungan Uji Mutu",
    phase: "Opsional",
    variant: "optional",
    chips: [{ label: "Jadwal admin" }],
  },
  {
    title: "Produksi & Kirim",
    phase: "Eksekusi pabrik",
    variant: "anchor",
    chips: [
      { label: "PO + DP", tone: "blue" },
      { label: "Pelunasan tiba", tone: "accent" },
    ],
  },
  {
    title: "Opsional Pasang",
    phase: "Layanan lapangan",
    variant: "install",
    chips: [{ label: "Min. 200 m²" }, { label: "Survei gratis", tone: "accent" }],
  },
];

/**
 * Diagram Alur Pemesanan 5 Langkah (/paket-proyek).
 * Menggantikan daftar teks bernomor dengan alur proses terhubung (chevron ortogonal,
 * rel fase & gerbang pembayaran di desktop, serta penanda opsional bergaris putus-putus).
 */
export function AlurProyekDiagram({ langkah }: { langkah: string[] }) {
  return (
    <figure className="paket-alur-region">
      {/* Rel dimensi fase & gerbang finansial untuk desktop (>= 1025px) */}
      <svg
        className="paket-alur-rail"
        viewBox="0 0 1060 66"
        aria-hidden="true"
        style={{ fontFamily: "var(--font-isi)" }}
      >
        {/* Fase 1: Pra-order (Langkah 1-2) */}
        <text x="205" y="14" textAnchor="middle" fill="#254186" fontSize="11" fontWeight="700" letterSpacing="0.06em">
          FASE 1 · PRA-ORDER &amp; PENAWARAN
        </text>
        <path d="M 4 20 V 32 M 406 20 V 32 M 4 26 H 406 M 0 30 l 8 -8 M 402 30 l 8 -8" fill="none" stroke="#254186" strokeWidth="1.4" />

        {/* Fase Opsional: Cek Pabrik (Langkah 3) */}
        <text x="530" y="14" textAnchor="middle" fill="#4b5568" fontSize="11" fontWeight="700" letterSpacing="0.06em">
          OPSIONAL · VERIFIKASI
        </text>
        <path d="M 436 20 V 32 M 624 20 V 32" fill="none" stroke="#4d66a8" strokeWidth="1.4" />
        <path d="M 436 26 H 624" fill="none" stroke="#4d66a8" strokeWidth="1.4" strokeDasharray="4 3" />

        {/* Fase 2: Eksekusi & Serah Terima (Langkah 4-5) */}
        <text x="855" y="14" textAnchor="middle" fill="#b8350e" fontSize="11" fontWeight="700" letterSpacing="0.06em">
          FASE 2 · PRODUKSI, KIRIM &amp; PASANG
        </text>
        <path d="M 654 20 V 32 M 1056 20 V 32 M 654 26 H 1056 M 650 30 l 8 -8 M 1052 30 l 8 -8" fill="none" stroke="#d63f12" strokeWidth="1.6" />

        {/* Gerbang milestone: Dokumen tertulis & PO + DP */}
        <rect x="252" y="40" width="122" height="22" rx="11" fill="#ffe6dc" stroke="#ffb59a" strokeWidth="1" />
        <text x="313" y="55" textAnchor="middle" fill="#b8350e" fontSize="11" fontWeight="700">
          Dokumen tertulis
        </text>

        <rect x="602" y="40" width="76" height="22" rx="11" fill="#0e2a6b" />
        <text x="640" y="55" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="700">
          PO + DP
        </text>

        <rect x="692" y="40" width="114" height="22" rx="11" fill="#e3e9f5" stroke="#254186" strokeWidth="1" />
        <text x="749" y="55" textAnchor="middle" fill="#0e2a6b" fontSize="11" fontWeight="700">
          Pelunasan tiba
        </text>
      </svg>

      {/* 5 node langkah terhubung chevron arah aliran */}
      <ol className="paket-alur-track">
        {ALUR_META.map((step, idx) => {
          const text = langkah[idx] ?? "";
          const stepClass =
            step.variant === "optional"
              ? "paket-alur-step is-optional"
              : step.variant === "anchor"
                ? "paket-alur-step is-anchor"
                : step.variant === "install"
                  ? "paket-alur-step is-install"
                  : "paket-alur-step";
          return (
            <li key={step.title} className="paket-alur-item">
              <div className={stepClass}>
                <div className="paket-alur-top">
                  <span className="paket-alur-num" aria-hidden="true">
                    {idx + 1}
                  </span>
                  <span className="paket-alur-phase">{step.phase}</span>
                </div>
                <h3>
                  <span className="sr-only">{idx + 1}. </span>
                  {step.title}
                </h3>
                <p className="paket-alur-desc">{text}</p>
                <div className="paket-alur-badges">
                  {step.chips.map((c) => (
                    <span
                      key={c.label}
                      className={`paket-gate-chip${c.tone === "accent" ? " is-accent" : c.tone === "blue" ? " is-blue" : ""}`}
                    >
                      {c.label}
                    </span>
                  ))}
                </div>
              </div>
              {idx < ALUR_META.length - 1 && (
                <div className="paket-alur-arrow" aria-hidden="true">
                  <svg className="arrow-right" width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M4 12H18M13 7L19 12L13 17" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <svg className="arrow-down" width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12 4V18M7 13L12 19L17 13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <figcaption className="paket-figure-caption">
        <span>
          Lima tahap pemesanan dari kirim BoQ sampai barang tiba di lokasi; kotak bergaris putus-putus menandakan tahapan opsional.
        </span>
        <span className="muted small tabular">Garis padat = alur wajib · Garis putus-putus = opsional</span>
      </figcaption>
    </figure>
  );
}
