-- Porting inventori-ops 0093-0101: buku keluar-masuk kendaraan, kasbon, dana & piutang PIC kendaraan,
-- periode slip gaji, batch benda uji, dan sub kategori biaya armada.
CREATE TABLE `ops_vehicle_trips` (
	`id` text PRIMARY KEY NOT NULL,
	`delivery_id` text,
	`vehicle_id` text,
	`plate` text,
	`driver_id` text,
	`driver_name` text,
	`purpose` text DEFAULT 'lain' NOT NULL,
	`cargo` text,
	`destination` text,
	`note` text,
	`out_at` integer,
	`in_at` integer,
	`out_by_name` text,
	`in_by_name` text,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ops_vt_delivery_uq` ON `ops_vehicle_trips` (`delivery_id`);--> statement-breakpoint
CREATE INDEX `ops_vt_out_idx` ON `ops_vehicle_trips` (`out_at`);--> statement-breakpoint
CREATE TABLE `ops_kasbon_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_name` text NOT NULL,
	`entry_date` text NOT NULL,
	`kind` text NOT NULL,
	`amount` real NOT NULL,
	`note` text,
	`created_by` integer,
	`created_by_name` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ops_kasbon_name_idx` ON `ops_kasbon_entries` (`employee_name`,`entry_date`);--> statement-breakpoint
CREATE TABLE `ops_fleet_cash` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_date` text NOT NULL,
	`amount` real NOT NULL,
	`source` text,
	`note` text,
	`created_by` integer,
	`created_by_name` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ops_fleet_cash_date_idx` ON `ops_fleet_cash` (`entry_date`);--> statement-breakpoint
CREATE TABLE `ops_cepi_loans` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_date` text NOT NULL,
	`kind` text NOT NULL,
	`amount` real NOT NULL,
	`method` text,
	`note` text,
	`created_by` integer,
	`created_by_name` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ops_cepi_loans_date_idx` ON `ops_cepi_loans` (`entry_date`);--> statement-breakpoint
ALTER TABLE `qc_strength_samples` ADD `batch_code` text;--> statement-breakpoint
ALTER TABLE `ops_fleet_expenses` ADD `subcategory` text;--> statement-breakpoint
ALTER TABLE `ops_fleet_expenses` ADD `trip_ref` text;--> statement-breakpoint
ALTER TABLE `ops_fleet_expenses` ADD `due_date` text;--> statement-breakpoint
ALTER TABLE `ops_fleet_expenses` ADD `tempo_paid_at` integer;--> statement-breakpoint
ALTER TABLE `ops_fleet_expenses` ADD `tempo_paid_by_name` text;--> statement-breakpoint
ALTER TABLE `ops_fleet_expenses` ADD `tempo_reminded_on` text;--> statement-breakpoint
ALTER TABLE `ops_payslips` ADD `pay_kind` text;--> statement-breakpoint
ALTER TABLE `ops_payslips` ADD `period_from` text;--> statement-breakpoint
ALTER TABLE `ops_payslips` ADD `period_to` text;
