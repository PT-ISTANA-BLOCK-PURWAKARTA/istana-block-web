-- Rapikan konten situs: tebal Hexagon/Fullpave 6 & 8 cm, jarak Cianjur & Bandung Barat, gratis ongkir bersyarat. TERAPKAN HANYA SETELAH PEMILIK MENYETUJUI.
-- Dibuat 2026-11-20 dari SELECT read-only D1 production (istana-block-web-db).
-- Jalankan: wrangler d1 execute DB --remote --file scripts/konten/2026-11-20-rapikan-konten.sql

UPDATE articles SET content = replace(content, '| Hexagon | 20 × 20 cm | 6 cm |', '| Hexagon | 20 × 20 cm | 6 & 8 cm |') WHERE id = 8 AND slug = 'perbedaan-truepave-hexagon-fullpave-grass-block';
UPDATE articles SET content = replace(content, '| Fullpave 21 | 21 × 21 cm | 6 cm |', '| Fullpave 21 | 21 × 21 cm | 6 & 8 cm |') WHERE id = 8 AND slug = 'perbedaan-truepave-hexagon-fullpave-grass-block';
UPDATE articles SET content = replace(content, '| Fullpave 30 | 30 × 30 cm | 6 cm |', '| Fullpave 30 | 30 × 30 cm | 6 & 8 cm |') WHERE id = 8 AND slug = 'perbedaan-truepave-hexagon-fullpave-grass-block';
UPDATE articles SET content = replace(content, '**Hexagon** 20 × 20 cm, tebal 6 cm,', '**Hexagon** 20 × 20 cm, tebal 6 & 8 cm,') WHERE id = 10 AND slug = 'paving-block-u-ditch-buis-beton-bersertifikat-tkdn';
UPDATE articles SET content = replace(content, '**Fullpave 21** 21 × 21 cm, tebal 6 cm,', '**Fullpave 21** 21 × 21 cm, tebal 6 & 8 cm,') WHERE id = 10 AND slug = 'paving-block-u-ditch-buis-beton-bersertifikat-tkdn';
UPDATE articles SET content = replace(content, '**Fullpave 30** 30 × 30 cm, tebal 6 cm,', '**Fullpave 30** 30 × 30 cm, tebal 6 & 8 cm,') WHERE id = 10 AND slug = 'paving-block-u-ditch-buis-beton-bersertifikat-tkdn';
UPDATE articles SET excerpt = replace(excerpt, '20 × 20 cm, tebal 6 cm,', '20 × 20 cm, tebal 6 & 8 cm,') WHERE id = 33 AND slug = 'paving-block-segi-6';
UPDATE articles SET seo_description = replace(seo_description, '20 × 20 cm, tebal 6 cm,', '20 × 20 cm, tebal 6 & 8 cm,') WHERE id = 33 AND slug = 'paving-block-segi-6';
UPDATE articles SET content = replace(content, '- Ukuran 20 × 20 cm, tebal 6 cm', '- Ukuran 20 × 20 cm, tebal 6 & 8 cm') WHERE id = 33 AND slug = 'paving-block-segi-6';
UPDATE pages SET content = replace(content, '| Tebal 6 cm; estetika taman & perumahan |', '| Tebal 6 cm & 8 cm; estetika taman & perumahan |') WHERE id = 33 AND slug = 'paving-block-purwakarta';
UPDATE pages SET content = replace(content, 'Segi enam tebal 6 cm untuk taman & halaman', 'Segi enam tebal 6 cm & 8 cm untuk taman & halaman') WHERE id = 35 AND slug = 'paving-block-cianjur';
UPDATE articles SET content = replace(content, 'seperti gratis ongkos kirim untuk area tertentu di sekitar Purwakarta,', 'seperti gratis ongkir untuk muatan penuh di sekitar Pasawahan, syarat berlaku — tanyakan admin,') WHERE id = 12 AND slug = 'harga-paving-block-purwakarta-2026';
UPDATE articles SET content = replace(content, '- Pengiriman gratis: Kami menawarkan pengiriman gratis untuk semua pembelian paving block.', '- Gratis ongkir: tersedia untuk muatan penuh di sekitar Pasawahan, syarat berlaku — tanyakan admin.') WHERE id = 119 AND slug = 'distributor-paving-block';
UPDATE pages SET content = replace(content, 'Ongkir wilayah Purwakarta sangat terjangkau atau bahkan bebas ongkir untuk volume muatan penuh di sekitar area Pasawahan.', 'Ongkir ditulis terpisah di penawaran, kecuali promo gratis ongkir untuk muatan penuh di sekitar Pasawahan (syarat berlaku — tanyakan admin).') WHERE id = 33 AND slug = 'paving-block-purwakarta';
UPDATE articles SET content = replace(content, '- Penawaran harga resmi termasuk ongkos kirim ke lokasi proyek.', '- Penawaran harga resmi mencantumkan ongkos kirim ke lokasi proyek, ditulis terpisah dari harga produk.') WHERE id = 10 AND slug = 'paving-block-u-ditch-buis-beton-bersertifikat-tkdn';
UPDATE pages SET content = replace(content, '| ±28 km | ±45 menit |', '| ±30 km | ±45 menit |') WHERE id = 34 AND slug = 'paving-block-bandung-barat-cimahi';
UPDATE pages SET content = replace(content, '| ±46 km | ±1 jam |', '| ±55 km | ±1 jam |') WHERE id = 34 AND slug = 'paving-block-bandung-barat-cimahi';
UPDATE pages SET content = replace(content, '| ±49 km | ±1 jam 10 menit |', '| ±50 km | ±1 jam 10 menit |') WHERE id = 34 AND slug = 'paving-block-bandung-barat-cimahi';
UPDATE pages SET content = replace(content, '| ±55 km | ±1 jam 20 menit |', '| ±60–70 km | ±1 jam 20 menit |') WHERE id = 34 AND slug = 'paving-block-bandung-barat-cimahi';
UPDATE pages SET content = replace(content, '| ±58 km | ±1 jam 15 menit |', '| ±60 km | ±1 jam 15 menit |') WHERE id = 34 AND slug = 'paving-block-bandung-barat-cimahi';
UPDATE pages SET content = replace(content, '| ±65 km | ±1 jam 30 menit |', '| ±65–70 km | ±1 jam 30 menit |') WHERE id = 34 AND slug = 'paving-block-bandung-barat-cimahi';
UPDATE pages SET content = replace(content, '| ±26 km | ±45 menit |', '| ±55 km | ±1 jam 5 menit |') WHERE id = 35 AND slug = 'paving-block-cianjur';
UPDATE pages SET content = replace(content, '| ±38 km | ±1 jam 10 menit |', '| ±80 km | ±1 jam 15 menit |') WHERE id = 35 AND slug = 'paving-block-cianjur';
UPDATE pages SET content = replace(content, '| ±45 km | ±1 jam 20 menit |', '| ±80–85 km | ±1 jam 35 menit |') WHERE id = 35 AND slug = 'paving-block-cianjur';
UPDATE pages SET content = replace(content, '| ±48 km | ±1 jam 25 menit |', '| ±70 km | ±1 jam 25 menit |') WHERE id = 35 AND slug = 'paving-block-cianjur';
UPDATE pages SET content = replace(content, '| ±52 km | ±1 jam 30 menit |', '| ±75 km | ±1 jam 30 menit |') WHERE id = 35 AND slug = 'paving-block-cianjur';
UPDATE pages SET content = replace(content, '| ±62 km | ±1 jam 45 menit |', '| ±90–95 km | ±1 jam 50 menit |') WHERE id = 35 AND slug = 'paving-block-cianjur';
UPDATE pages SET content = replace(content, 'sekitar 45 menit sampai 1 jam 15 menit', 'sekitar 1 jam sampai 1 jam 15 menit') WHERE id = 35 AND slug = 'paving-block-cianjur';
