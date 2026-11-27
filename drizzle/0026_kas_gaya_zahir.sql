-- Kas Masuk/Keluar gaya Zahir: ID kontak (CUST-/VNDR-/EMPL-), jenis kontak karyawan, proyek & status draft di transaksi kas,
-- Job per baris alokasi dana. Hanya menambah kolom (rollback: drizzle/down/0026_kas_gaya_zahir.sql).
ALTER TABLE `fin_contacts` ADD COLUMN `code` text DEFAULT '' NOT NULL;
ALTER TABLE `fin_cash_txns` ADD COLUMN `project_id` text;
ALTER TABLE `fin_cash_txns` ADD COLUMN `status` text DEFAULT 'rekam' NOT NULL;
ALTER TABLE `fin_cash_lines` ADD COLUMN `project_id` text;
CREATE INDEX `fin_contacts_code_idx` ON `fin_contacts` (`code`);
