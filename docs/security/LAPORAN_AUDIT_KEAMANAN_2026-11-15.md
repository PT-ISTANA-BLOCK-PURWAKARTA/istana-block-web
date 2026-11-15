# Laporan Audit Keamanan — Istana Block Purwakarta (`istana-block-web`)
**Tanggal Audit:** 15 November 2026  
**Metodologi:** [Cloudflare Security Audit Skill](https://github.com/cloudflare/security-audit-skill)  
**Status Audit:** Selesai & 100% Diperbaiki (*Remediated & Live*)  
**ID Versi Cloudflare Live:** `6c47cde9-f54e-4a50-9aaf-d3182e722f55`  
**Commit Git:** `4e371fd` & `01a6749`

---

## 1. Ringkasan Eksekutif

Audit keamanan menyeluruh telah dilakukan terhadap basis kode `istana-block-web` (Next.js 15, OpenNext, Cloudflare Workers, D1 Database, dan Cloudflare R2). Audit berfokus pada perimeter edge proxy, integritas sesi & autentikasi, otorisasi server actions, pencegahan injeksi SQL, keamanan penyimpanan R2, serta perlindungan browser client-side.

- **Total Temuan Dikonfirmasi:** 5 (4 Medium, 1 Low)
- **Status Perbaikan:** 100% Diperbaiki, Diuji, dan Aktif di Produksi (*Live*).
- **Hasil Validator Resmi Cloudflare:**
  - `validate-coverage-ledger.cjs`: **PASS** (5/5 unit coverage valid)
  - `validate-findings.cjs`: **PASS** (5/5 findings schema valid)

---

## 2. Rincian Temuan & Solusi Perbaikan

### Temuan 1: Missing Security Headers on Static Assets & Worker Cache (`ibw:sec-001:edge-headers`)
- **Tingkat Keparahan:** Medium
- **Berkas Terdampak:** `worker.ts`, `public/_headers`
- **Isu:** Respons cache Worker dan aset statis yang disajikan langsung oleh edge Cloudflare belum menyertakan header keamanan modern secara konsisten. Aset statis dapat dimuat tanpa HSTS, CSP, atau perlindungan frame.
- **Perbaikan:**
  - Di `worker.ts`: Menambahkan header `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, dan `Permissions-Policy: camera=(), microphone=(), geolocation=(self)` pada fungsi `respond`, `addSecurityHeaders`, serta respon redirect HTTPS 301.
  - Di `public/_headers`: Menambahkan blok catch-all `/*` untuk menjamin seluruh aset edge disajikan dengan header keamanan lengkap.

---

### Temuan 2: Missing X-Content-Type-Options on Public Media Route (`ibw:sec-002:r2-media-nosniff`)
- **Tingkat Keparahan:** Low
- **Berkas Terdampak:** `src/app/media/[...key]/route.ts`
- **Isu:** Endpoint publik yang menyajikan media dari bucket R2 tidak mengirimkan header `X-Content-Type-Options: nosniff`. Hal ini dapat dieksploitasi untuk serangan *MIME Confusion / MIME Sniffing* jika berkas media diunggah dengan format berbahaya.
- **Perbaikan:** Menambahkan `headers.set("x-content-type-options", "nosniff");` dan `headers.set("x-frame-options", "SAMEORIGIN");` pada respon rute media R2.

---

### Temuan 3: Incomplete .gitignore Coverage for Local Accounts & Secrets (`ibw:sec-003:gitignore-secrets`)
- **Tingkat Keparahan:** Medium
- **Berkas Terdampak:** `.gitignore`
- **Isu:** Berkas konfigurasi akun dan kredensial lokal (seperti `akun-demo.local.json`, `akun-produksi.local.json`, `.dev.vars*`, sertifikat `.pem`, dan `wrangler.local.jsonc`) berpotensi tidak sengaja terdorong (*committed*) ke repositori publik.
- **Perbaikan:** Menambahkan aturan pencegahan eksplisit pada `.gitignore`:
  ```gitignore
  *.local.json
  akun-*.local.json
  .dev.vars*
  *.pem
  wrangler.local.jsonc
  ```

---

### Temuan 4: Permissive CSP & Missing Permissions-Policy (`ibw:sec-004:csp-permissions`)
- **Tingkat Keparahan:** Medium
- **Berkas Terdampak:** `next.config.ts`
- **Isu:** Konfigurasi CSP Next.js sebelumnya terlalu longgar dan tidak membatasi kemampuan browser client-side (kamera, mikrofon, geolokasi) serta belum memaksa *upgrade* otomatis konten HTTP campuran (*mixed content*).
- **Perbaikan:** Menambahkan direktif CSP ketat dan Permissions-Policy pada `headers()` di `next.config.ts`:
  ```typescript
  { key: "Content-Security-Policy", value: "upgrade-insecure-requests; frame-ancestors 'self'; base-uri 'self'; object-src 'none';" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  ```

---

### Temuan 5: Fragile Cookie Secure Flag Dependent on NODE_ENV (`ibw:sec-005:cookie-secure-flag`)
- **Tingkat Keparahan:** Medium
- **Berkas Terdampak:** `src/lib/session.ts`
- **Isu:** Cookie sesi pengguna (`ib_session`) sebelumnya hanya menambahkan atribut `Secure` jika `process.env.NODE_ENV === "production"`. Pada lingkungan staging, preview workers, atau custom deployment di mana `NODE_ENV` bernilai selain `"production"`, cookie berisiko dikirimkan melalui saluran tidak terenkripsi.
- **Perbaikan:** Mengubah pengecekan menjadi `secure: process.env.NODE_ENV !== "development"` sehingga cookie sesi dijamin selalu `Secure` di seluruh lingkungan deployed.

---

## 3. Titik Keamanan Positif yang Terkonfirmasi Aman

Selain 5 temuan di atas, audit memverifikasi area kritis lainnya dan mengonfirmasi bahwa arsitektur saat ini telah memenuhi standar keamanan tinggi:

1. **Bebas Injeksi SQL (D1 Database):** Seluruh query database D1 menggunakan Drizzle ORM dengan *parameterized queries* atau *template tags* `sql` terparameterisasi. Tidak ditemukan penggunaan string concatenation pada query SQL.
2. **Otorisasi Server Actions Ketat:** Semua modul sensitif (`/operasional`, `/akuntansi`, `/situs`, `/internal`) secara konsisten memanggil verifikasi peran dan hak akses (`requirePerm`, `requireModule`, `requireAdmin`, `requireOwner`) sebelum memproses data.
3. **Pencegahan SSRF (Server-Side Request Forgery):** Pengiriman notifikasi Web Push VAPID (`src/lib/ops/push.ts`) memvalidasi domain push service dengan daftar putih ketat (`fcm.googleapis.com`, `push.apple.com`, `push.services.mozilla.com`, `notify.windows.com`).
4. **Pencegahan Open Redirect:** Redireksi navigasi pasca-login menggunakan fungsi `safeNext` yang menolak URL absolut luar, protocol-relative (`//`), dan karakter backslash.
5. **Perlindungan Brute Force:** Endpoint login menerapkan rate limiting bertingkat berdasarkan IP dan identifier pengguna.

---

## 4. Hasil Verifikasi Live Produksi

Pengujian langsung terhadap `https://istanablock.com` membuktikan seluruh proteksi telah aktif:

```bash
$ curl -k -I https://istanablock.com
HTTP/2 200
server: cloudflare
cf-ray: a5ab97457fde7ae3-CGK
strict-transport-security: max-age=63072000; includeSubDomains; preload
content-security-policy: upgrade-insecure-requests; frame-ancestors 'self'; base-uri 'self'; object-src 'none';
permissions-policy: camera=(), microphone=(), geolocation=(self)
referrer-policy: strict-origin-when-cross-origin
x-content-type-options: nosniff
x-frame-options: SAMEORIGIN
```

Seluruh artefak audit mesin (`run-metadata.json`, `architecture.md`, `coverage-ledger.json`, `findings.json`, `REPORT.md`, `FINDINGS-DETAIL.md`) tersimpan permanen di direktori:  
`C:\Users\Sarimusan\security-audit-skill\istana-block-web\run-1\`
