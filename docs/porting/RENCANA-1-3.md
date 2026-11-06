# Rencana kerja 1–3 (6 November 2026)

Tiga pekerjaan yang tersisa setelah schema + data + halaman baca-saja selesai. Urutan ini yang disepakati pemilik.

## 1. Form input/ubah + cetak PDF

Empat dokumen, satu pola berulang. Urut dari yang paling sedikit menyentuh keuangan:

| Dokumen | Tabel | Aksi baru | Cetak |
|---|---|---|---|
| Gaji | `ops_payslips` | buat, ubah, hapus | slip A5, tanda tangan pemilik |
| Surat jalan | `ops_delivery_notes` | buat dari PO, ubah, batalkan | A4 3 rangkap (arsip, sopir, pelanggan) |
| Penawaran | `ops_quotations` | buat, ubah, kirim, terima/tolak | A4 berkop, syarat & bank |
| Faktur penjualan | `ops_sales_invoices` | buat dari PO/surat jalan, ubah, tandai lunas | A4 berkop, PPN, rekening |

Pola teknis per dokumen (mengikuti yang sudah ada di repo):

1. `src/lib/ops/<dokumen>.ts` — fungsi server: `buat`, `ubah`, `daftar`, `ambil`, penomoran memakai `sys_sequences` (sudah ada, dipakai faktur keuangan).
2. `src/app/operasional/(panel)/<dokumen>/actions.ts` — server action dengan guard `opsAccess()` + `can(roles, perm)`, lalu `revalidatePath`.
3. `src/components/ops/<dokumen>/Form*.tsx` — form klien memakai komponen `Form`/`Select` yang sudah ada.
4. Cetak: route `/operasional/cetak/<dokumen>/[id]` yang hanya merender HTML siap cetak (`@media print`), lalu tombol "Cetak" memanggil `window.print()`. PDF dihasilkan dari dialog cetak browser — sama seperti `docs/contoh-cetak/`.

Verifikasi tiap dokumen: buat 1 dokumen di D1 lokal, cek nomor unik, cetak, lalu hapus.

## 2. Faktur penjualan → piutang

Keputusan yang dipakai (perlu dikonfirmasi saat implementasi): faktur jual **masuk piutang keuangan**, bukan berdiri sendiri.

- `ops_sales_invoices` tetap menyimpan dokumen cetak (nomor, items, kapal/plat, penanda tangan).
- Saat faktur diterbitkan: buat `fin_invoices` (kind `jual`) + `fin_invoice_lines` dari `items`, dan jurnal piutang:
  - Debit **Piutang Usaha**, Kredit **Pendapatan Penjualan** untuk DPP.
  - Debit **Piutang Usaha**, Kredit **PPN Keluaran** bila `ppn_percent > 0`.
- Saat ditandai lunas: buat `fin_receipts` + alokasi ke `fin_invoice_lines`, jurnal Debit **Kas/Bank**, Kredit **Piutang Usaha**.
- Tautan balik: kolom `fin_invoices` perlu penanda dokumen sumber (`source_key` = `sales-invoice:<id>`), ditambah di migrasi `0009` bersama index-nya.
- 7 faktur hasil impor: dibuatkan entri `fin_invoices` + jurnal lewat skrip ETL lanjutan (`scripts/porting/posting-faktur.py`), bukan diketik manual.

Perlu keputusan pemilik saat mulai: akun pendapatan mana (dari 48 akun awal), cara pembulatan PPN, dan apakah faktur lama ikut diposting ke jurnal atau hanya dicatat sebagai piutang awal.

## 3. Bundel Worker & Workers Paid

Fakta: build terakhir 2,93 MB gzip terhadap batas Workers Free 3,07 MB; STATUS §6 mencatat 27/200 permintaan dingin gagal `1102` karena CPU 10 ms.

- **Tindakan pemilik:** upgrade paket Workers Paid. Ini pembayaran di dashboard Cloudflare, tidak bisa dikerjakan dari repo.
- **Setelah paket berbayar**, di `wrangler.jsonc` tambahkan:

  ```jsonc
  "limits": { "cpu_ms": 30000 }
  ```

  Jangan ditambahkan selama masih Free — deploy akan ditolak.
- **Setelah itu** ukur ulang: `npx wrangler deploy --dry-run` (harus di bawah 10 MB gzip untuk paket berbayar), lalu deploy `` dengan `OPEN_NEXT_DEPLOY=true` dari Windows setelah build OpenNext di WSL (resep di `docs/STATUS.md` §10).

## Urutan eksekusi yang disarankan

1. Gaji (paling berdiri sendiri, tanpa jurnal).
2. Surat jalan + cetak.
3. Penawaran + cetak.
4. Faktur jual + cetak, lalu posting piutang (butuh keputusan akun).
5. Workers Paid → deploy → uji 200 permintaan dingin.
