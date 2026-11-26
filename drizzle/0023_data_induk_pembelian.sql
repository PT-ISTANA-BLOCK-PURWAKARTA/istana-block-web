-- Data induk Zahir (satuan, pajak, departemen, proyek), tag proyek/departemen per baris jurnal,
-- dan dokumen Permintaan Penawaran (RFQ) / Pesanan Pembelian (PO) ke pemasok.
CREATE TABLE `fin_units` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE UNIQUE INDEX `fin_units_code_uq` ON `fin_units` (`code`);
CREATE TABLE `fin_taxes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`rate` real DEFAULT 0 NOT NULL,
	`sales_account_id` text,
	`purchase_account_id` text,
	`note` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE UNIQUE INDEX `fin_taxes_code_uq` ON `fin_taxes` (`code`);
CREATE TABLE `fin_departments` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE UNIQUE INDEX `fin_departments_code_uq` ON `fin_departments` (`code`);
CREATE TABLE `fin_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`contact_id` text,
	`location` text DEFAULT '' NOT NULL,
	`start_date` text,
	`end_date` text,
	`budget` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'aktif' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE UNIQUE INDEX `fin_projects_code_uq` ON `fin_projects` (`code`);
ALTER TABLE `fin_journal_lines` ADD `project_id` text;
ALTER TABLE `fin_journal_lines` ADD `department_id` text;
CREATE INDEX `fin_jl_project_idx` ON `fin_journal_lines` (`project_id`);
CREATE INDEX `fin_jl_department_idx` ON `fin_journal_lines` (`department_id`);
CREATE TABLE `fin_purchase_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`number` text NOT NULL,
	`date` text NOT NULL,
	`contact_id` text NOT NULL,
	`expected_date` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`subtotal` integer DEFAULT 0 NOT NULL,
	`tax` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`memo` text DEFAULT '' NOT NULL,
	`source_id` text,
	`bill_id` text,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE UNIQUE INDEX `fin_purchase_orders_number_uq` ON `fin_purchase_orders` (`number`);
CREATE INDEX `fin_purchase_orders_contact_idx` ON `fin_purchase_orders` (`contact_id`);
CREATE TABLE `fin_purchase_order_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`item_id` text,
	`description` text DEFAULT '' NOT NULL,
	`qty` real DEFAULT 1 NOT NULL,
	`unit` text DEFAULT '' NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL
);
CREATE INDEX `fin_pol_order_idx` ON `fin_purchase_order_lines` (`order_id`);
-- Isi awal
INSERT OR IGNORE INTO `fin_units` (`id`, `code`, `name`) VALUES
	('unit-pcs', 'pcs', 'Buah / pieces'), ('unit-m2', 'm2', 'Meter persegi'), ('unit-m3', 'm3', 'Meter kubik'), ('unit-kg', 'kg', 'Kilogram'),
	('unit-zak', 'zak', 'Zak / sak'), ('unit-rit', 'rit', 'Rit / ritase'), ('unit-ltr', 'liter', 'Liter'), ('unit-unit', 'unit', 'Unit'), ('unit-set', 'set', 'Set'), ('unit-btg', 'batang', 'Batang');
INSERT OR IGNORE INTO `fin_taxes` (`id`, `code`, `name`, `rate`, `sales_account_id`, `purchase_account_id`, `note`) VALUES
	('tax-ppn', 'PPN', 'Pajak Pertambahan Nilai', 11, (SELECT id FROM fin_accounts WHERE system_key = 'ppn_keluaran'), (SELECT id FROM fin_accounts WHERE system_key = 'ppn_masukan'), 'Tarif mengikuti Pengaturan Keuangan saat membuat faktur'),
	('tax-pph23', 'PPh 23', 'PPh Pasal 23 (jasa)', 2, NULL, NULL, 'Dipotong pelanggan / dipotong ke pemasok jasa'),
	('tax-pph42', 'PPh 4(2)', 'PPh Final Pasal 4 ayat 2 (konstruksi)', 1.75, NULL, (SELECT id FROM fin_accounts WHERE code = '230-18'), 'Jasa konstruksi');
