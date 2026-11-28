-- Histori dokumen Zahir (hanya baca): Penjualan, Pengiriman (DO), Pembelian, Penerimaan barang (PD) Jun–Okt 2026
-- dari laporan Rincian Zahir 28/11/2026. TIDAK membuat jurnal (jurnalnya sudah ada, source 'zahir'); hanya ditautkan.
-- Rollback: drizzle/down/0028_histori_zahir.sql.
CREATE TABLE `zh_docs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`ref` text NOT NULL,
	`date` text NOT NULL,
	`party_code` text DEFAULT '' NOT NULL,
	`party_name` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`order_ref` text DEFAULT '' NOT NULL,
	`subtotal` real DEFAULT 0 NOT NULL,
	`journal_number` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE UNIQUE INDEX `zh_docs_kind_ref_uq` ON `zh_docs` (`kind`, `ref`);
CREATE INDEX `zh_docs_kind_date_idx` ON `zh_docs` (`kind`, `date`);
CREATE INDEX `zh_docs_party_idx` ON `zh_docs` (`party_code`);
CREATE TABLE `zh_doc_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`doc_id` text NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`qty` real DEFAULT 0 NOT NULL,
	`unit` text DEFAULT '' NOT NULL,
	`price` real DEFAULT 0 NOT NULL,
	`amount` real DEFAULT 0 NOT NULL
);
CREATE INDEX `zh_doc_lines_doc_idx` ON `zh_doc_lines` (`doc_id`);
