-- Harta tetap (daftar aset + penyusutan bulanan otomatis) dan anggaran per akun per bulan.
CREATE TABLE `fin_fixed_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`asset_account_id` text NOT NULL,
	`accum_account_id` text,
	`expense_account_id` text,
	`acquired_date` text NOT NULL,
	`start_date` text NOT NULL,
	`cost` integer NOT NULL,
	`salvage` integer DEFAULT 0 NOT NULL,
	`life_months` integer DEFAULT 0 NOT NULL,
	`method` text DEFAULT 'garis_lurus' NOT NULL,
	`opening_accum` integer DEFAULT 0 NOT NULL,
	`opening_date` text,
	`location` text DEFAULT '' NOT NULL,
	`disposed_date` text,
	`disposal_note` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE UNIQUE INDEX `fin_fixed_assets_code_uq` ON `fin_fixed_assets` (`code`);
CREATE TABLE `fin_depreciation_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`period` text NOT NULL,
	`asset_id` text NOT NULL,
	`journal_id` text NOT NULL,
	`amount` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE UNIQUE INDEX `fin_depr_asset_period_uq` ON `fin_depreciation_lines` (`asset_id`,`period`);
CREATE INDEX `fin_depr_period_idx` ON `fin_depreciation_lines` (`period`);
CREATE TABLE `fin_budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`period` text NOT NULL,
	`amount` integer NOT NULL,
	`updated_by` integer,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE UNIQUE INDEX `fin_budgets_acc_period_uq` ON `fin_budgets` (`account_id`,`period`);
CREATE INDEX `fin_budgets_period_idx` ON `fin_budgets` (`period`);
