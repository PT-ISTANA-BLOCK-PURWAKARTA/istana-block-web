import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { getEnv } from "@/db";
import { waLink } from "@/lib/format";
import { getSettings } from "@/lib/settings";

const TITLE = "Panduan Desain Lahan & Estimasi Paving";
const DESCRIPTION =
  "Panduan praktis menggambar batas lahan di grid bermeter, peta satelit, serta impor berkas GeoJSON, KML, dan KMZ untuk simulasi kebutuhan paving presisi.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/panduan-desain-paving" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/panduan-desain-paving",
  },
};

export default async function PanduanDesainPavingPage() {
  const [s, env] = await Promise.all([getSettings(), getEnv()]);
  const url = `${env.SITE_URL}/panduan-desain-paving`;

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Beranda", item: env.SITE_URL },
              { "@type": "ListItem", position: 2, name: "Kalkulator Pola Paving", item: `${env.SITE_URL}/pola-paving` },
              { "@type": "ListItem", position: 3, name: "Panduan Desain Lahan", item: url },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "HowTo",
            name: "Cara Mendesain Lahan dan Menghitung Kebutuhan Paving Block",
            description: DESCRIPTION,
            step: [
              {
                "@type": "HowToStep",
                name: "Pilih Metode Penentuan Batas Lahan",
                text: "Gunakan bentuk siap pakai (persegi, L, U), gambar di kisi bermeter, tandai di peta satelit, atau unggah berkas KML/GeoJSON.",
              },
              {
                "@type": "HowToStep",
                name: "Pilih Model Paving dan Motif Pemasangan",
                text: "Pilih produk Truepave, Hexagon, atau Fullpave dengan pola susun bata, tulang ikan (herringbone), atau anyaman.",
              },
              {
                "@type": "HowToStep",
                name: "Periksa Rekomendasi Keping & Potongan Tepi",
                text: "Sistem menghitung jumlah blok utuh, potongan batas, dan cadangan pemotongan 5-10% secara matematis.",
              },
            ],
          },
        ]}
      />

      <div className="wrap" style={{ paddingBottom: 48 }}>
        <nav aria-label="Lokasi halaman" className="breadcrumb">
          <ol>
            <li>
              <Link href="/">Beranda</Link>
            </li>
            <li>
              <Link href="/pola-paving">Kalkulator Pola Paving</Link>
            </li>
            <li>Panduan Desain Lahan</li>
          </ol>
        </nav>

        <article style={{ maxWidth: 840, margin: "0 auto", display: "flex", flexDirection: "column", gap: 32 }}>
          <header style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--biru)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Panduan Teknis Lapangan
            </span>
            <h1 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--tinta)" }}>
              Cara Mengukur Lahan &amp; Mendesain Tata Letak Paving Block
            </h1>
            <p className="hero-lead" style={{ fontSize: 17, lineHeight: 1.6, color: "var(--redup)" }}>
              Tidak semua bidang tanah berbentuk persegi sempurna. Halaman rumah, ruko, dan jalan lingkungan
              seringkali memiliki sudut miring, lekukan berbentuk L atau U, hingga pulau taman di bagian tengah.
              Panduan ini menjelaskan cara memanfaatkan fitur <strong>Paving Designer</strong> untuk mendapatkan
              angka kebutuhan material yang presisi tanpa menebak-nebak.
            </p>
          </header>

          <hr style={{ border: 0, borderTop: "1px solid #e2e8f0" }} />

          {/* Bagian 1: Grid Bermeter */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--tinta)" }}>
              1. Menggambar Lahan di Kanvas Grid Bermeter
            </h2>
            <p style={{ lineHeight: 1.6, color: "var(--redup)" }}>
              Metode ini cocok untuk Anda yang sudah memegang catatan ukuran fisik tanah dari pita ukur atau denah denah arsitek:
            </p>
            <ol style={{ paddingLeft: 22, lineHeight: 1.7, color: "var(--tinta)" }}>
              <li><strong>Klik titik awal</strong> pada bidang grid. Setiap kotak kecil mewakili skala meter yang presisi.</li>
              <li><strong>Tarik garis ke titik sudut berikutnya</strong> dan klik untuk meletakkan patok sudut tanah Anda.</li>
              <li><strong>Klik kembali titik awal</strong> untuk mengunci poligon menjadi bidang tertutup. Luas lahan (m²) dan panjang keliling (m) akan langsung terhitung secara otomatis.</li>
              <li>Bila ada kesalahan posisi patok, Anda dapat menekan tombol <em>Hapus Titik Terakhir</em> atau tombol <em>Reset</em> untuk memulai ulang.</li>
            </ol>
          </section>

          {/* Bagian 2: Peta Satelit */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--tinta)" }}>
              2. Menandai Lahan di Peta Satelit Resolusi Tinggi
            </h2>
            <p style={{ lineHeight: 1.6, color: "var(--redup)" }}>
              Jika Anda ingin memperkirakan kebutuhan proyek yang luas (seperti area parkir pabrik, gudang, atau jalan komplek di Purwakarta dan sekitarnya):
            </p>
            <ul style={{ paddingLeft: 22, lineHeight: 1.7, color: "var(--tinta)" }}>
              <li>Pilih menu tab <strong>Peta Satelit</strong>. Peta satelit otomatis terpusat pada wilayah Jawa Barat dengan proyeksi UTM zona 48S / 49S.</li>
              <li>Perbesar (zoom-in) ke lokasi properti Anda menggunakan sentuhan jari (di HP) atau roda scroll mouse (di laptop).</li>
              <li>Klik pada batas-batas fisik tanah (misalnya pagar keliling, parit, atau batas jalan aspal) sudut demi sudut.</li>
              <li>Tekan tombol <strong>Terapkan Bentuk Lahan</strong> untuk langsung memproses pemotongan paving blok di atas bidang tersebut.</li>
            </ul>
            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: "14px 18px", borderRadius: 12, fontSize: 14, color: "#1e40af" }}>
              💡 <strong>Catatan Akurasi:</strong> Citra satelit sangat berguna untuk visualisasi dan estimasi anggaran awal. Namun karena sudut pengambilan foto udara, selalu lakukan verifikasi pengukuran fisik langsung di lokasi sebelum instalasi paving dilakukan.
            </div>
          </section>

          {/* Bagian 3: Impor GeoJSON & KML/KMZ */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--tinta)" }}>
              3. Impor Berkas Batas Lahan (Google Earth &amp; GPS)
            </h2>
            <p style={{ lineHeight: 1.6, color: "var(--redup)" }}>
              Paving Designer mendukung impor berkas <strong>.kml</strong>, <strong>.kmz</strong>, dan <strong>.geojson</strong> berstandar koordinat geografis WGS84:
            </p>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--tinta)", marginTop: 8 }}>
              Cara Ekspor Berkas dari Google Earth:
            </h3>
            <ol style={{ paddingLeft: 22, lineHeight: 1.7, color: "var(--tinta)" }}>
              <li>Buka Google Earth (aplikasi desktop atau web).</li>
              <li>Pilih ikon <strong>Tambah Poligon (Add Polygon)</strong>, lalu gambar garis mengelilingi batas tanah proyek Anda.</li>
              <li>Klik kanan pada poligon yang baru dibuat di panel sisi kiri &rarr; pilih <strong>Simpan Tempat Sebagai (Save Place As...)</strong>.</li>
              <li>Pilih ekstensi berkas <strong>.kmz</strong> atau <strong>.kml</strong> lalu simpan di perangkat Anda.</li>
              <li>Buka Paving Designer Istana Block, pilih tab <strong>Impor GeoJSON/KML</strong>, dan tarik berkas tersebut ke kotak yang tersedia.</li>
            </ol>
            <p style={{ fontSize: 13, color: "var(--redup)" }}>
              Seluruh proses ekstraksi berkas berlangsung 100% di peramban browser Anda tanpa diunggah ke server, menjaga kerahasiaan data lokasi proyek Anda.
            </p>
          </section>

          {/* Bagian 4: Membaca Estimasi */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--tinta)" }}>
              4. Cara Membaca Hasil Rincian Material &amp; Cadangan
            </h2>
            <p style={{ lineHeight: 1.6, color: "var(--redup)" }}>
              Berbeda dari kalkulator umum yang sekadar mengalikan luas dengan angka konstan, engine Istana Block melakukan pemotongan geometris nyata:
            </p>
            <ul style={{ paddingLeft: 22, lineHeight: 1.7, color: "var(--tinta)" }}>
              <li><strong>Blok Utuh:</strong> Kepingan paving yang terpasang sempurna tanpa perlu dipotong mesin gerinda sama sekali.</li>
              <li><strong>Potongan Tepi:</strong> Kepingan di pinggiran batas atau sekitar pulau lubang yang terpotong sudut miring. Pada praktik tukang pasang profesional, setiap potongan membutuhkan 1 keping stok bahan awal.</li>
              <li><strong>Cadangan (%):</strong> Standar cadangan adalah 5% untuk pola susun lurus/tulang ikan 90°, dan 10% untuk pola diagonal miring atau bentuk lahan yang sangat berliku, guna mengantisipasi blok pecah saat penurunan muatan truk atau salah potong.</li>
              <li><strong>Abu Batu &amp; Base Course:</strong> Abu batu setebal 5 cm dihitung sebagai alas perata paving. Sedangkan sirtu/batu pecah base course setebal 20 cm dihitung sebagai pondasi pemadatan jalan agar tidak amblas tergilas kendaraan.</li>
            </ul>
          </section>

          {/* CTA Section */}
          <section style={{ background: "var(--latar, #f1f3f6)", padding: "28px 24px", borderRadius: 20, textAlign: "center", display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--tinta)" }}>
              Siap Menghitung Lahan Proyek Anda?
            </h2>
            <p style={{ maxWidth: 600, margin: "0 auto", color: "var(--redup)", fontSize: 15 }}>
              Gunakan simulasi interaktif kami sekarang. Anda dapat melihat denah tampak atas 2D, pratinjau 3D realistis, dan langsung mengirim rincian ke WhatsApp admin.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
              <Link href="/pola-paving" className="btn btn-primary" style={{ padding: "12px 24px" }}>
                Buka Paving Designer Sekarang &rarr;
              </Link>
              <a
                href={waLink(s.whatsapp, "Halo Admin Istana Block, saya ingin konsultasi mengenai desain dan estimasi paving lahan proyek saya.")}
                target="_blank"
                rel="noopener"
                className="btn btn-secondary"
                style={{ padding: "12px 24px" }}
              >
                Konsultasi WhatsApp Admin
              </a>
            </div>
          </section>
        </article>
      </div>
    </>
  );
}
