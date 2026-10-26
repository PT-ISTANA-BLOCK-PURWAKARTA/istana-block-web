# Fixture uji migrasi

`backup-contoh/` = backup sintetis aplikasi lama (dibuat `buat-fixture.mjs`, keluaran selalu sama). Berisi kasus tepi: HP beda format,
email bentrok (`pemilik@uji.local`, `ADMIN@istana.test` ganda), plat beda spasi/huruf, nama barang sama/beda, foto hilang & yatim, PO terbuka.

Snapshot web untuk uji dibuat dari D1 lokal (bukan produksi; berisi akun uji + hash, jangan di-commit):

    wsl -e bash -lc ". ~/.nvm/nvm.sh; cd ~/ibw-ops; CI=1 npx wrangler d1 export DB --local --output /mnt/c/Users/Sarimusan/ibw-port/scripts/migrasi-inventori-ops/fixture/snap-web-lokal.sql"

Jalankan (keluaran ke `out/`, kredensial ke `rahasia/`; keduanya di-gitignore):

    node scripts/migrasi-inventori-ops/migrasi.mjs --backup scripts/migrasi-inventori-ops/fixture/backup-contoh --snapshot scripts/migrasi-inventori-ops/fixture/snap-web-lokal.sql --out scripts/migrasi-inventori-ops/fixture/out --final --open=skip
