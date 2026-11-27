-- Saldo awal piutang & hutang per faktur dari Zahir (sub-ledger). Faktur saldo awal TIDAK membuat jurnal:
-- saldonya sudah ada di akun Piutang/Hutang Usaha. Hanya tambahan kolom & tabel (rollback: drizzle/down/0025_saldo_awal_per_faktur.sql).
CREATE TABLE `fin_opening_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`as_of` text NOT NULL,
	`file_name` text DEFAULT '' NOT NULL,
	`row_count` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`gl_balance` integer DEFAULT 0 NOT NULL,
	`difference` integer DEFAULT 0 NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`created_by` integer,
	`created_by_name` text DEFAULT '' NOT NULL,
	`cancelled_at` integer,
	`cancelled_by_name` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
ALTER TABLE `fin_invoices` ADD COLUMN `opening_batch_id` text;
ALTER TABLE `fin_invoices` ADD COLUMN `ext_ref` text;
ALTER TABLE `fin_bills` ADD COLUMN `opening_batch_id` text;
ALTER TABLE `fin_bills` ADD COLUMN `ext_ref` text;
CREATE UNIQUE INDEX `fin_invoices_ext_ref_uq` ON `fin_invoices` (`ext_ref`, `contact_id`) WHERE `ext_ref` IS NOT NULL;
CREATE UNIQUE INDEX `fin_bills_ext_ref_uq` ON `fin_bills` (`ext_ref`, `contact_id`) WHERE `ext_ref` IS NOT NULL;
CREATE INDEX `fin_invoices_opening_idx` ON `fin_invoices` (`opening_batch_id`);
CREATE INDEX `fin_bills_opening_idx` ON `fin_bills` (`opening_batch_id`);
