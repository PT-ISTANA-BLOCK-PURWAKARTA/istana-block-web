type IllustrationProps = {
  className?: string;
};

/**
 * Ilustrasi teknis untuk panel "Yang perlu disiapkan saat menghubungi":
 * kisi blueprint, kaliper ukur presisi, paving block beton, dan pin lokasi bongkar.
 */
export function PrepChecklistIllustration({ className }: IllustrationProps) {
  const gridId = "kontak-prep-grid";
  const shadeId = "kontak-prep-shade";

  return (
    <svg
      viewBox="0 0 440 164"
      width="440"
      height="164"
      fill="none"
      aria-hidden="true"
      className={className}
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      <defs>
        <pattern id={gridId} width="18" height="18" patternUnits="userSpaceOnUse">
          <path d="M 18 0 L 0 0 0 18" stroke="#254186" strokeOpacity="0.1" strokeWidth="0.9" />
        </pattern>
        <linearGradient id={shadeId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#E3E9F5" stopOpacity="0.65" />
        </linearGradient>
      </defs>

      {/* Lembar blueprint */}
      <rect x="1.5" y="1.5" width="437" height="161" rx="16" fill="#F5F7FC" stroke="#254186" strokeOpacity="0.2" strokeWidth="1.5" />
      <rect x="8" y="8" width="424" height="148" rx="12" fill={`url(#${gridId})`} />

      {/* Penanda sudut teknis */}
      <path d="M 18 28 V 18 H 28 M 412 18 H 422 V 28 M 18 136 V 146 H 28 M 412 146 H 422 V 136" stroke="#254186" strokeOpacity="0.35" strokeWidth="1.5" strokeLinecap="round" />

      {/* 1. Kaliper dimensi di atas paving block */}
      <g>
        {/* Batang ukur horizontal kaliper */}
        <rect x="34" y="24" width="144" height="10" rx="3" fill="#254186" />
        <path
          d="M 48 25 V 30 M 60 25 V 29 M 72 25 V 30 M 84 25 V 29 M 96 25 V 30 M 108 25 V 29 M 120 25 V 30 M 132 25 V 29 M 144 25 V 30 M 156 25 V 29 M 168 25 V 30"
          stroke="#FFFFFF"
          strokeOpacity="0.7"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        {/* Rahang tetap kiri */}
        <path d="M 42 24 H 52 V 76 L 46 84 L 42 76 Z" fill="#0E2A6B" />
        {/* Rahang geser kanan dengan penanda oranye */}
        <path d="M 142 24 H 154 V 76 L 146 84 L 142 76 Z" fill="#0E2A6B" />
        <rect x="138" y="22" width="20" height="14" rx="3.5" fill="#FE5722" stroke="#0E2A6B" strokeWidth="1.5" />
        <line x1="148" y1="26" x2="148" y2="32" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />

        {/* Garis dimensi lebar */}
        <line x1="46" y1="48" x2="142" y2="48" stroke="#FE5722" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M 52 45 L 46 48 L 52 51 M 136 45 L 142 48 L 136 51" stroke="#FE5722" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Paving block beton (isometrik presisi) */}
        <g transform="translate(0, 2)">
          {/* Bayangan dasar */}
          <path d="M 54 128 L 150 128 L 170 112 L 74 112 Z" fill="#0E2A6B" fillOpacity="0.1" />
          {/* Sisi depan (tebal 6/8 cm) */}
          <path d="M 48 84 H 144 V 118 H 48 Z" fill="#B5B4AF" stroke="#0E2A6B" strokeWidth="1.8" strokeLinejoin="round" />
          {/* Sisi samping kanan */}
          <path d="M 144 84 L 168 68 V 102 L 144 118 Z" fill="#9A9993" stroke="#0E2A6B" strokeWidth="1.8" strokeLinejoin="round" />
          {/* Permukaan atas bevel */}
          <path d="M 48 84 L 72 68 H 168 L 144 84 Z" fill="#DCDAD4" stroke="#0E2A6B" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M 56 81 L 74 71 H 158 L 142 81 Z" stroke="#FFFFFF" strokeOpacity="0.65" strokeWidth="1.2" />
          {/* Tekstur agregat beton */}
          <circle cx="70" cy="100" r="1.5" fill="#0E2A6B" fillOpacity="0.32" />
          <circle cx="96" cy="95" r="1.3" fill="#254186" fillOpacity="0.32" />
          <circle cx="118" cy="105" r="1.6" fill="#0E2A6B" fillOpacity="0.3" />
          <circle cx="84" cy="108" r="1.2" fill="#254186" fillOpacity="0.28" />
          {/* Motif hex tipis di permukaan paving */}
          <polygon points="108,73 116,76 116,79 108,82 100,79 100,76" fill="none" stroke="#254186" strokeOpacity="0.35" strokeWidth="1.1" />
        </g>

        {/* Kaliper ketebalan sisi kanan paving */}
        <path d="M 174 70 H 184 M 174 104 H 184 M 179 70 V 104" stroke="#FE5722" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="179" cy="87" r="2.5" fill="#FE5722" />
      </g>

      {/* Jalur penghubung blueprint */}
      <path d="M 192 87 H 294" stroke="#254186" strokeOpacity="0.45" strokeWidth="1.6" strokeDasharray="5 4" />
      <circle cx="192" cy="87" r="3" fill="#254186" />

      {/* 2. Modul ukuran area & volume (m² / pcs) */}
      <g>
        <rect x="212" y="54" width="64" height="64" rx="12" fill={`url(#${shadeId})`} stroke="#254186" strokeWidth="1.7" />
        <line x1="244" y1="54" x2="244" y2="118" stroke="#254186" strokeOpacity="0.25" strokeWidth="1.2" />
        <line x1="212" y1="86" x2="276" y2="86" stroke="#254186" strokeOpacity="0.25" strokeWidth="1.2" />
        {/* Ikon paving hex kecil + dimensi diagonal */}
        <polygon points="228,62 236,66 236,74 228,78 220,74 220,66" fill="#B5B4AF" fillOpacity="0.65" stroke="#0E2A6B" strokeWidth="1.3" />
        <polygon points="260,94 268,98 268,106 260,110 252,106 252,98" fill="#E3E9F5" stroke="#254186" strokeWidth="1.3" />
        <path d="M 222 108 L 266 64" stroke="#FE5722" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M 259 64 H 266 V 71 M 229 108 H 222 V 101" stroke="#FE5722" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* 3. Pin lokasi & akses jalan truk bongkar */}
      <g>
        <circle cx="294" cy="87" r="3" fill="#FE5722" />
        {/* Landasan akses truk */}
        <rect x="304" y="102" width="104" height="32" rx="10" fill="#E3E9F5" stroke="#254186" strokeOpacity="0.35" strokeWidth="1.4" />
        <line x1="316" y1="118" x2="396" y2="118" stroke="#B5B4AF" strokeWidth="2.4" strokeDasharray="7 5" strokeLinecap="round" />

        {/* Gelombang titik pin */}
        <ellipse cx="356" cy="116" rx="26" ry="9" fill="#FE5722" fillOpacity="0.14" stroke="#FE5722" strokeOpacity="0.55" strokeWidth="1.3" />
        <ellipse cx="356" cy="116" rx="12" ry="4.5" fill="#0E2A6B" fillOpacity="0.18" />

        {/* Pin lokasi utama */}
        <path
          d="M 356 32 C 337.8 32 323 46.8 323 65 C 323 89.2 356 115 356 115 C 356 115 389 89.2 389 65 C 389 46.8 374.2 32 356 32 Z"
          fill="#FE5722"
          stroke="#0E2A6B"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="356" cy="64" r="14" fill="#FFFFFF" stroke="#0E2A6B" strokeWidth="1.6" />
        <polygon points="356,55 363.5,59.5 363.5,68.5 356,73 348.5,68.5 348.5,59.5" fill="#254186" />
      </g>
    </svg>
  );
}

/**
 * Ilustrasi alur 5 langkah pemesanan untuk panel "Cara memesan":
 * Hubungi -> Pilih -> Hitung -> Jadwal -> Kirim.
 */
export function OrderStepsIllustration({ className }: IllustrationProps) {
  const bgId = "kontak-steps-bg";

  const steps = [
    { x: 56, num: "1", label: "Hubungi", fill: "#254186" },
    { x: 143, num: "2", label: "Pilih", fill: "#0E2A6B" },
    { x: 230, num: "3", label: "Hitung", fill: "#254186" },
    { x: 317, num: "4", label: "Jadwal", fill: "#0E2A6B" },
    { x: 404, num: "5", label: "Kirim", fill: "#FE5722" },
  ] as const;

  const arrows = [99.5, 186.5, 273.5, 360.5];

  return (
    <svg
      viewBox="0 0 460 164"
      width="460"
      height="164"
      fill="none"
      aria-hidden="true"
      className={className}
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      <defs>
        <linearGradient id={bgId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F5F7FC" />
          <stop offset="100%" stopColor="#EDF1FA" />
        </linearGradient>
      </defs>

      {/* Kartu diagram latar */}
      <rect x="1.5" y="1.5" width="457" height="161" rx="16" fill={`url(#${bgId})`} stroke="#254186" strokeOpacity="0.2" strokeWidth="1.5" />

      {/* Aksen sudut paving segi enam halus */}
      <polygon points="24,18 33,23 33,33 24,38 15,33 15,23" stroke="#B5B4AF" strokeOpacity="0.4" strokeWidth="1.2" />
      <polygon points="436,126 445,131 445,141 436,146 427,141 427,131" stroke="#B5B4AF" strokeOpacity="0.4" strokeWidth="1.2" />

      {/* Jalur penghubung horizontal */}
      <line x1="56" y1="74" x2="404" y2="74" stroke="#B5B4AF" strokeWidth="4" strokeLinecap="round" />
      <line x1="56" y1="74" x2="404" y2="74" stroke="#254186" strokeOpacity="0.45" strokeWidth="2" strokeDasharray="5 4" />

      {/* Panah arah antar simpul */}
      {arrows.map((ax) => (
        <g key={ax} transform={`translate(${ax}, 74)`}>
          <circle cx="0" cy="0" r="10" fill="#FFFFFF" stroke="#B5B4AF" strokeWidth="1.3" />
          <path d="M -2.5 -4 L 2.5 0 L -2.5 4" stroke="#FE5722" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}

      {/* 5 Simpul langkah */}
      {steps.map((step, idx) => (
        <g key={step.label}>
          {/* Nomor urut di atas */}
          <rect
            x={step.x - 11}
            y="18"
            width="22"
            height="18"
            rx="9"
            fill={idx === 4 ? "#0E2A6B" : "#FFFFFF"}
            stroke={idx === 4 ? "#0E2A6B" : "#B5B4AF"}
            strokeWidth="1.3"
          />
          <text
            x={step.x}
            y="31"
            textAnchor="middle"
            fill={idx === 4 ? "#FFFFFF" : "#0E2A6B"}
            fontFamily="var(--font-judul, Poppins, system-ui, sans-serif)"
            fontSize="11"
            fontWeight="700"
          >
            {step.num}
          </text>

          {/* Ubin ikon utama */}
          <rect
            x={step.x - 26}
            y="48"
            width="52"
            height="52"
            rx="15"
            fill={step.fill}
            stroke={idx === 4 ? "#0E2A6B" : "#0E2A6B"}
            strokeOpacity={idx === 4 ? 1 : 0.16}
            strokeWidth={idx === 4 ? 1.8 : 1.2}
          />

          {/* Ikon spesifik tiap langkah */}
          {idx === 0 && (
            /* 1. Hubungi: gelembung chat WhatsApp */
            <g transform={`translate(${step.x}, 74)`}>
              <path
                d="M -12 -9 H 12 C 13.7 -9 15 -7.7 15 -6 V 7 C 15 8.7 13.7 10 12 10 H -3 L -10 15 V 10 H -12 C -13.7 10 -15 8.7 -15 7 V -6 C -15 -7.7 -13.7 -9 -12 -9 Z"
                fill="#FFFFFF"
              />
              <circle cx="-6" cy="0.5" r="2.1" fill="#FE5722" />
              <circle cx="0" cy="0.5" r="2.1" fill="#254186" />
              <circle cx="6" cy="0.5" r="2.1" fill="#254186" />
            </g>
          )}

          {idx === 1 && (
            /* 2. Pilih: susunan blok paving segi enam */
            <g transform={`translate(${step.x}, 74)`}>
              <polygon points="-7,-14 0,-10 0,-2 -7,2 -14,-2 -14,-10" fill="#FFFFFF" />
              <polygon points="7,-14 14,-10 14,-2 7,2 0,-2 0,-10" fill="#B5B4AF" />
              <polygon points="0,-2 7,2 7,10 0,14 -7,10 -7,2" fill="#FE5722" />
            </g>
          )}

          {idx === 2 && (
            /* 3. Hitung: kalkulator / lembar ukur */
            <g transform={`translate(${step.x}, 74)`}>
              <rect x="-12" y="-14" width="24" height="28" rx="4" fill="#FFFFFF" />
              <rect x="-8" y="-10" width="16" height="6" rx="1.5" fill="#FE5722" />
              <circle cx="-6" cy="1" r="1.8" fill="#0E2A6B" />
              <circle cx="0" cy="1" r="1.8" fill="#0E2A6B" />
              <circle cx="6" cy="1" r="1.8" fill="#0E2A6B" />
              <circle cx="-6" cy="8" r="1.8" fill="#B5B4AF" />
              <circle cx="0" cy="8" r="1.8" fill="#B5B4AF" />
              <circle cx="6" cy="8" r="1.8" fill="#254186" />
            </g>
          )}

          {idx === 3 && (
            /* 4. Jadwal: kalender + tanda centang */
            <g transform={`translate(${step.x}, 74)`}>
              <rect x="-13" y="-11" width="26" height="24" rx="4" fill="#FFFFFF" />
              <path d="M -13 -5 H 13" stroke="#0E2A6B" strokeWidth="1.5" />
              <rect x="-13" y="-11" width="26" height="7" rx="3" fill="#FE5722" />
              <line x1="-6" y1="-14" x2="-6" y2="-9" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
              <line x1="6" y1="-14" x2="6" y2="-9" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M -6 4 L -1.5 8.5 L 7 -0.5" stroke="#0E2A6B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          )}

          {idx === 4 && (
            /* 5. Kirim: truk armada pabrik */
            <g transform={`translate(${step.x}, 74)`}>
              {/* Bak muatan beton */}
              <rect x="-15" y="-8" width="19" height="14" rx="2.5" fill="#FFFFFF" stroke="#0E2A6B" strokeWidth="1.4" />
              <line x1="-11" y1="-3" x2="0" y2="-3" stroke="#B5B4AF" strokeWidth="2" strokeLinecap="round" />
              <line x1="-11" y1="1" x2="0" y2="1" stroke="#B5B4AF" strokeWidth="2" strokeLinecap="round" />
              {/* Kabin truk */}
              <path d="M 4 -4 H 11 L 15 1 V 6 H 4 V -4 Z" fill="#FFFFFF" stroke="#0E2A6B" strokeWidth="1.4" strokeLinejoin="round" />
              {/* Roda */}
              <circle cx="-9" cy="9" r="3.6" fill="#0E2A6B" stroke="#FFFFFF" strokeWidth="1.4" />
              <circle cx="9.5" cy="9" r="3.6" fill="#0E2A6B" stroke="#FFFFFF" strokeWidth="1.4" />
            </g>
          )}

          {/* Label langkah */}
          <text
            x={step.x}
            y="124"
            textAnchor="middle"
            fill="#0E2A6B"
            fontFamily="var(--font-judul, Poppins, system-ui, sans-serif)"
            fontSize="13.5"
            fontWeight="700"
          >
            {step.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
