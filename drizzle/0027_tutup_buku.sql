-- Tutup buku per periode: catatan siapa/kapan/alasan, hasil analisa & potret angka untuk audit.
-- Kunci transaksi tetap lewat pengaturan fin_lock_date (assertOpen). Rollback: drizzle/down/0027_tutup_buku.sql.
CREATE TABLE `fin_period_closes` (
	`id` text PRIMARY KEY NOT NULL,
	`period` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`status` text DEFAULT 'ditutup' NOT NULL,
	`lock_before` text DEFAULT '' NOT NULL,
	`issues` integer DEFAULT 0 NOT NULL,
	`warnings` integer DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`snapshot` text DEFAULT '{}' NOT NULL,
	`closed_by` integer,
	`closed_by_name` text DEFAULT '' NOT NULL,
	`closed_at` integer DEFAULT (unixepoch()) NOT NULL,
	`reopened_by` integer,
	`reopened_by_name` text,
	`reopened_at` integer,
	`reopen_reason` text
);
CREATE INDEX `fin_period_closes_period_idx` ON `fin_period_closes` (`period`, `closed_at`);
