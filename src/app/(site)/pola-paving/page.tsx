import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { PatternCalculator } from "@/components/PatternCalculator";
import { getEnv } from "@/db";
import { telLink, waLink } from "@/lib/format";
import { getSettings } from "@/lib/settings";

const TITLE = "Kalkulator Pola & Warna Paving";
const DESCRIPTION =
  "Pilih jenis paving, motif, dan warna, lihat pratinjau berskala asli, lalu hitung pcs per warna, kanstin, abu batu, dan base course. Kirim rinciannya ke WhatsApp.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/pola-paving" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/pola-paving", images: [{ url: "/og-default.jpg", width: 1200, height: 630 }] },
};

const FAQ = [
  {
    q: "Berapa pcs paving per m²?",
    a: "Truepave/bata 21 × 10,5 cm sekitar 44 pcs/m², Hexagon 20 × 20 cm 27 pcs/m², Fullpave/ubin 21 × 21 cm 22 pcs/m², Fullpave 30 × 30 cm 11 pcs/m², dan Grass Block 45 × 30 cm 7,5 pcs/m². Angka ini sudah memperhitungkan celah nat. Jumlah pcs = luas area × isi per m² × (1 + cadangan), dibulatkan ke atas.",
  },
  {
    q: "Berapa cadangan yang perlu disiapkan?",
    a: "Untuk pola lurus seperti susun bata, tulang ikan 90°, dan susun lurus, cadangan 5% biasanya cukup untuk potongan di tepi dan blok yang pecah saat bongkar muat. Pola miring 45° dan hexagon menghasilkan lebih banyak potongan, jadi disarankan 10%. Area kecil atau berbentuk tidak beraturan bisa butuh lebih.",
  },
  {
    q: "Apa fungsi abu batu dan base course, dan bagaimana menghitungnya?",
    a: "Base course (sirtu atau batu pecah) setebal ±20 cm dipadatkan sebagai lapis pondasi agar paving tidak amblas, terutama di area kendaraan. Di atasnya digelar abu batu ±5 cm sebagai alas perata tempat paving diletakkan. Volume = luas × tebal: 50 m² butuh 2,5 m³ abu batu dan 10 m³ base course. Angka ini volume padat; material lepas menyusut saat dipadatkan, jadi pesan sedikit lebih banyak.",
  },
  {
    q: "Apakah hasil kalkulator bisa langsung dipesan?",
    a: "Bisa. Tekan Kirim ke WhatsApp: produk, motif, jumlah per warna, ukuran, cadangan, kanstin, dan material dasar ikut terkirim. Tambahkan lokasi kirim, lalu admin memeriksa hitungan dan mengirim penawaran harga plus ongkir.",
  },
];

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PolaPavingPage({ searchParams }: Props) {
  const [s, env, query] = await Promise.all([getSettings(), getEnv(), searchParams]);
  const url = `${env.SITE_URL}/pola-paving`;
  const consult = "Halo Istana Block, saya ingin konsultasi memilih pola paving untuk proyek saya.";

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: TITLE,
            description: DESCRIPTION,
            url,
            inLanguage: "id",
            applicationCategory: "UtilitiesApplication",
            operatingSystem: "Semua peramban web",
            isAccessibleForFree: true,
            offers: { "@type": "Offer", price: "0", priceCurrency: "IDR" },
            featureList: [
              "Pratinjau pola paving tampak atas berskala asli",
              "Komposisi warna dihitung dari motif",
              "Jumlah pcs per warna, kanstin, abu batu, dan base course",
              "Kirim rincian ke WhatsApp, salin, atau cetak PDF",
            ],
            publisher: { "@id": `${env.SITE_URL}/#business` },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Beranda", item: env.SITE_URL },
              { "@type": "ListItem", position: 2, name: "Kalkulator pola paving", item: url },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          },
        ]}
      />
      <div className="wrap" style={{ paddingBottom: 24 }}>
        <nav aria-label="Lokasi halaman" className="breadcrumb" data-pp-noprint>
          <ol>
            <li>
              <Link href="/">Beranda</Link>
            </li>
            <li>Kalkulator pola paving</li>
          </ol>
        </nav>
        <header data-pp-noprint style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 780, padding: "18px 0 26px" }}>
          <h1 style={{ fontSize: "clamp(32px, 4.4vw, 52px)", fontWeight: 700, letterSpacing: "-0.02em" }}>Kalkulator pola &amp; warna paving</h1>
          <p className="hero-lead" style={{ maxWidth: 720 }}>
            Pilih jenis paving, motif, dan warna, lalu lihat pratinjau tampak atas dengan skala asli. Kalkulator menghitung jumlah pcs per warna lengkap
            dengan kanstin, abu batu, dan base course, dan rinciannya bisa langsung dikirim ke admin untuk penawaran harga dan ongkir.
          </p>
        </header>

        <PatternCalculator whatsapp={s.whatsapp} initialQuery={query} />

        <section className="duo" data-pp-noprint style={{ paddingTop: 56 }}>
          <div className="stack faq" style={{ flex: "1 1 520px", minWidth: 0, gap: 12 }}>
            <h2 style={{ fontSize: 34, marginBottom: 8 }}>Pertanyaan umum</h2>
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
          <aside className="cta-aside hexpat" style={{ flex: "1 1 320px", minWidth: 0 }}>
            <h2>Bingung memilih pola?</h2>
            <p>Ceritakan fungsi area dan ukurannya. Admin membantu memilih pola, tebal, dan warna yang cocok, lalu mengirim penawaran tertulis.</p>
            <a className="btn btn-primary" href={waLink(s.whatsapp, consult)} target="_blank" rel="noopener">
              Konsultasi via WhatsApp
            </a>
            <a href={telLink(s.phone)}>atau telepon {s.phone}</a>
            <Link href="/produk/paving-block">Lihat harga paving block →</Link>
          </aside>
        </section>
      </div>
    </>
  );
}
