-- Rekonsiliasi bank: baris mutasi rekening koran (impor dari BCA / CSV / Excel) yang dicocokkan
-- dengan baris jurnal rekening kas/bank, dan catatan rekonsiliasi per akhir periode.
CREATE TABLE `fin_bank_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`date` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`amount` integer NOT NULL,
	`balance` integer,
	`fingerprint` text NOT NULL,
	`import_id` text,
	`matched_line_id` text,
	`matched_at` integer,
	`matched_by` integer,
	`note` text DEFAULT '' NOT NULL,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE UNIQUE INDEX `fin_bank_lines_fp_uq` ON `fin_bank_lines` (`account_id`,`fingerprint`);
CREATE INDEX `fin_bank_lines_acc_idx` ON `fin_bank_lines` (`account_id`,`date`);
CREATE UNIQUE INDEX `fin_bank_lines_match_uq` ON `fin_bank_lines` (`matched_line_id`) WHERE `matched_line_id` IS NOT NULL;
CREATE TABLE `fin_bank_recons` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`period_end` text NOT NULL,
	`statement_balance` integer NOT NULL,
	`book_balance` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_by` integer,
	`created_by_name` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE UNIQUE INDEX `fin_bank_recons_uq` ON `fin_bank_recons` (`account_id`,`period_end`);
