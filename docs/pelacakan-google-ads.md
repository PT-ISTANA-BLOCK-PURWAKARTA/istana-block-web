# Pelacakan Google Ads & GA4 di situs baru

Situs baru memuat container Google Tag Manager **GTM-PXSMDXD8**, container yang sama dengan situs WordPress lama. ID-nya ada di `wrangler.jsonc` → `vars.GTM_ID`, dan dipasang oleh `src/components/GoogleTagManager.tsx` di layout situs publik. Panel internal (`/situs`, `/operasional`, `/akuntansi`, `/internal`) tidak memuat GTM.

**Kapan GTM dimuat.**
- Di `istanablockpurwakarta.com` (host dari `SITE_URL`) dan `www.istanablockpurwakarta.com`: selalu.
- Di host lain (`*.workers.dev`, Worker demo): hanya bila URL berisi `?gtm_debug=…`, yaitu saat diuji lewat Tag Assistant. Tanda ini diingat selama tab terbuka.
- Hasilnya, kunjungan staging biasa tidak masuk data Google Ads maupun GA4.

Bagian kode sudah selesai. Langkah di bawah dikerjakan di **GTM** dan **Google Ads** oleh pemilik akun. Urutannya penting.

## 1. GTM: pastikan tag dasar ada di container

Di situs lama, tag dasar Google Ads (`AW-858211595`) dimuat oleh plugin Site Kit, **bukan** oleh GTM. Tag itu juga yang mengirim data ke GA4 dan mengisi audiens remarketing. Situs baru hanya memuat GTM. Jadi di GTM harus ada:

1. **Google tag `AW-858211595`**, pemicu *Initialization – All Pages*. Ini menggantikan Site Kit untuk remarketing dan conversion linker.
2. **Google tag `G-2GD4L62DJS`** (GA4), pemicu *Initialization – All Pages*. Lewati bila sudah ada.
3. **Conversion Linker**, pemicu *All Pages*. Lewati bila sudah ada.

Di GA4 → Admin → Data streams → web stream → *Enhanced measurement*, pastikan **"Page changes based on browser history events"** aktif. Situs baru berpindah halaman tanpa memuat ulang (next/link). Tanpa opsi ini, hanya halaman pertama yang terhitung.

## 2. Google Ads: buat conversion action klik WhatsApp & telepon

Google Ads → Goals → Conversions → **+ New conversion action** → Website → *Add a conversion action manually*:

| Nama | Kategori | Count | Status awal |
|---|---|---|---|
| Website → WhatsApp klik (wa.me) | Contact | One | Secondary dulu |
| Website → Telepon klik (tel:) | Phone call lead | One | Secondary dulu |

Catat **conversion label** masing-masing.

## 3. GTM: tag konversi dengan pemicu yang sudah ada

Container sudah punya pemicu klik tautan yang cocok dengan tombol situs baru:
- `185515958_4`: URL berisi `wa.me|whatsapp.com|whatsapp:|wa.link`. Ini mencakup header, bar bawah ponsel, halaman produk, kontak, dan kalkulator.
- `185515958_12`: URL diawali `tel:`.

Buat dua tag **Google Ads Conversion Tracking** (Conversion ID `858211595`, label dari langkah 2), satu per pemicu. Pada kedua tag, tambahkan **exception**: *Page Hostname* tidak sama dengan `istanablockpurwakarta.com`. Dengan begitu klik saat uji di staging tidak dihitung. Semua tombol WhatsApp membuka tab baru, jadi tidak perlu pengaturan *wait for tags*.

**Publish** container.

## 4. Uji di staging (sebelum domain dipindah)

1. Tag Assistant (tagassistant.google.com) → *Add domain* → `https://istana-block-web.abdussalimsan.workers.dev/`. Tag Assistant membuka situs dengan `?gtm_debug=…`.
2. Periksa: Google tag AW dan GA4 *Fired* di page load. Klik tombol WhatsApp dan pastikan tag konversi **Not fired** karena exception hostname. Itu tanda pengaman bekerja.
3. Pindah halaman lewat menu dan pastikan event `page_view` GA4 muncul di Realtime.

## 5. Setelah domain dipindah (Hari-H)

1. Ulangi uji Tag Assistant di `https://istanablockpurwakarta.com/`. Kali ini klik WhatsApp harus **Fired**.
2. Google Ads → Goals → Conversions → *Diagnostics*: konversi uji muncul dalam ±3 jam.
3. Setelah "WhatsApp klik" berstatus **Recording conversions**, jadikan **Primary**.
4. Jadikan conversion action lama **form kontak Elementor** (label `5bUECOKZrfEcEIuKnZkD`) **Secondary**. Jangan dihapus. Situs baru tidak punya form, jadi bila tetap Primary, Smart Bidding menunggu konversi yang tidak akan datang.
5. Nonaktifkan tag lama berlabel `kAqFCKDz_robEIuKnZkD` (`contact_click_early`). Event-nya dikirim skrip WordPress yang tidak ada di situs baru. Langkah ini mencegah hitungan ganda bila skrip serupa ditambahkan lagi.

## Opsional, nanti

- **Lead dari kalkulator** sebagai konversi Secondary terpisah: sudah dipasang di kode; tinggal buat pemicu GTM. Atribut `data-cta="kalkulator"` ada pada tombol "Kirim ke admin" (`src/components/Calculator.tsx`) dan "Kirim ke WhatsApp" (`src/components/PatternCalculator.tsx`). Di GTM buat pemicu *Click – Just Links* dengan kondisi *Click Element* cocok dengan selektor CSS `a[data-cta="kalkulator"]` (atau variabel *Click Element* → `dataset.cta` sama dengan `kalkulator`), lalu hubungkan ke tag konversi terpisah.
- **Kebijakan privasi** di panel `/situs` → Halaman: sebutkan bahwa situs memakai Google Analytics dan Google Ads (cookie pengukuran dan iklan).
