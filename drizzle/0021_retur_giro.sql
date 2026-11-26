-- Retur penjualan/pembelian, giro masuk/keluar, dan rekening sistem pendukungnya.
CREATE TABLE `fin_returns` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`number` text NOT NULL,
	`date` text NOT NULL,
	`contact_id` text NOT NULL,
	`invoice_id` text,
	`bill_id` text,
	`settlement` text NOT NULL,
	`cash_account_id` text,
	`subtotal` integer DEFAULT 0 NOT NULL,
	`tax` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`cost_back` integer DEFAULT 0 NOT NULL,
	`memo` text DEFAULT '' NOT NULL,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE UNIQUE INDEX `fin_returns_number_uq` ON `fin_returns` (`number`);
CREATE INDEX `fin_returns_invoice_idx` ON `fin_returns` (`invoice_id`);
CREATE INDEX `fin_returns_bill_idx` ON `fin_returns` (`bill_id`);
CREATE INDEX `fin_returns_contact_idx` ON `fin_returns` (`contact_id`);
CREATE TABLE `fin_return_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`return_id` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`qty` real DEFAULT 1 NOT NULL,
	`unit` text DEFAULT '' NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`account_id` text,
	`sort` integer DEFAULT 0 NOT NULL
);
CREATE INDEX `fin_return_lines_ret_idx` ON `fin_return_lines` (`return_id`);
CREATE TABLE `fin_giros` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`giro_no` text NOT NULL,
	`bank` text DEFAULT '' NOT NULL,
	`contact_id` text NOT NULL,
	`amount` integer NOT NULL,
	`issue_date` text NOT NULL,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'beredar' NOT NULL,
	`doc_id` text,
	`cleared_date` text,
	`cleared_account_id` text,
	`note` text DEFAULT '' NOT NULL,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE INDEX `fin_giros_kind_status_idx` ON `fin_giros` (`kind`, `status`, `due_date`);
INSERT OR IGNORE INTO `fin_accounts` (`id`, `code`, `name`, `grp`, `system_key`, `active`, `note`) VALUES
	('acc_113-10', '113-10', 'Giro Masuk (Belum Cair)', 'aset_lancar_lain', 'giro_masuk', 1, 'Giro/cek dari pelanggan yang belum jatuh tempo / belum dicairkan'),
	('acc_213-10', '213-10', 'Giro Keluar (Belum Cair)', 'hutang_lain', 'giro_keluar', 1, 'Giro/cek ke pemasok yang belum dicairkan bank'),
	('acc_410-30', '410-30', 'Retur Penjualan', 'pendapatan', 'retur_penjualan', 1, 'Pengurang penjualan (saldo debit)');
