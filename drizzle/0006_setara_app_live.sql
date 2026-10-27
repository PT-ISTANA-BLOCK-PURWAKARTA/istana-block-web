CREATE TABLE `inv_conversions` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`date` text NOT NULL,
	`moved_at` integer NOT NULL,
	`from_item_id` text NOT NULL,
	`to_item_id` text NOT NULL,
	`qty` real NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inv_conv_number_uq` ON `inv_conversions` (`number`);--> statement-breakpoint
CREATE INDEX `inv_conv_date_idx` ON `inv_conversions` (`date`);--> statement-breakpoint
CREATE INDEX `inv_conv_from_idx` ON `inv_conversions` (`from_item_id`);--> statement-breakpoint
CREATE INDEX `inv_conv_to_idx` ON `inv_conversions` (`to_item_id`);--> statement-breakpoint
CREATE TABLE `ops_customer_leads` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_date` text NOT NULL,
	`source` text DEFAULT 'Google Ads' NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`address` text,
	`product` text,
	`status` text DEFAULT 'follow_up' NOT NULL,
	`sale_value` integer,
	`price_nett` integer,
	`price_offer` integer,
	`reasons` text DEFAULT '[]' NOT NULL,
	`notes` text,
	`rating_service` integer,
	`rating_quality` integer,
	`rating_speed` integer,
	`rating_note` text,
	`rated_by` integer,
	`rated_at` integer,
	`feedback` text,
	`complaint_date` text,
	`complaint_note` text,
	`getback_date` text,
	`getback_note` text,
	`getback_result` text,
	`getback_by` integer,
	`contact_id` text,
	`import_key` text,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ops_cl_date_idx` ON `ops_customer_leads` (`contact_date`);--> statement-breakpoint
CREATE INDEX `ops_cl_status_idx` ON `ops_customer_leads` (`status`,`contact_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `ops_cl_import_uq` ON `ops_customer_leads` (`import_key`);--> statement-breakpoint
CREATE INDEX `ops_cl_contact_idx` ON `ops_customer_leads` (`contact_id`);--> statement-breakpoint
CREATE TABLE `qc_product_specs` (
	`id` text PRIMARY KEY NOT NULL,
	`line` text NOT NULL,
	`name` text NOT NULL,
	`variant` text,
	`weight_kg` real,
	`specs` text DEFAULT '{}' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`item_id` text,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `qc_ps_line_idx` ON `qc_product_specs` (`line`,`name`);--> statement-breakpoint
CREATE INDEX `qc_ps_item_idx` ON `qc_product_specs` (`item_id`);--> statement-breakpoint
CREATE TABLE `inv_production_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`cement_bags` real NOT NULL,
	`leader` text,
	`note` text DEFAULT '' NOT NULL,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inv_pb_date_idx` ON `inv_production_batches` (`date`);--> statement-breakpoint
CREATE TABLE `inv_count_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`count_id` text NOT NULL,
	`item_id` text NOT NULL,
	`system_qty` real NOT NULL,
	`counted_qty` real NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inv_cl_count_idx` ON `inv_count_lines` (`count_id`);--> statement-breakpoint
CREATE INDEX `inv_cl_item_idx` ON `inv_count_lines` (`item_id`);--> statement-breakpoint
CREATE TABLE `inv_counts` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`date` text NOT NULL,
	`counted_at` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inv_counts_number_uq` ON `inv_counts` (`number`);--> statement-breakpoint
CREATE INDEX `inv_counts_date_idx` ON `inv_counts` (`date`);--> statement-breakpoint
ALTER TABLE `inv_adjustments` ADD `count_id` text;--> statement-breakpoint
CREATE INDEX `inv_adj_count_idx` ON `inv_adjustments` (`count_id`);--> statement-breakpoint
ALTER TABLE `ops_calendar_participants` ADD `attendance_signed_at` integer;--> statement-breakpoint
ALTER TABLE `ops_deliveries` ADD `arrival_corrected_at` integer;--> statement-breakpoint
ALTER TABLE `ops_deliveries` ADD `arrival_corrected_by` integer;--> statement-breakpoint
ALTER TABLE `ops_deliveries` ADD `arrival_correction_made_at` integer;--> statement-breakpoint
ALTER TABLE `ops_deliveries` ADD `arrival_correction_reason` text;--> statement-breakpoint
ALTER TABLE `ops_goods_receipts` ADD `test_skipped_at` integer;--> statement-breakpoint
ALTER TABLE `ops_goods_receipts` ADD `test_skip_level` text;--> statement-breakpoint
ALTER TABLE `ops_goods_receipts` ADD `test_skip_reason` text;--> statement-breakpoint
ALTER TABLE `ops_goods_receipts` ADD `test_skipped_by` integer;--> statement-breakpoint
ALTER TABLE `fin_items` ADD `production_line` text;--> statement-breakpoint
ALTER TABLE `fin_items` ADD `method` text;--> statement-breakpoint
ALTER TABLE `qc_mix_logs` ADD `grade_b` real;--> statement-breakpoint
ALTER TABLE `qc_mix_logs` ADD `half_pieces` real;--> statement-breakpoint
ALTER TABLE `inv_productions` ADD `grade_b` real;--> statement-breakpoint
ALTER TABLE `inv_productions` ADD `method` text;--> statement-breakpoint
ALTER TABLE `inv_productions` ADD `cement_kg` real;--> statement-breakpoint
ALTER TABLE `inv_productions` ADD `batch_id` text;--> statement-breakpoint
ALTER TABLE `inv_productions` ADD `mix_log_id` text;--> statement-breakpoint
ALTER TABLE `inv_productions` ADD `reject_manager_by` integer;--> statement-breakpoint
ALTER TABLE `inv_productions` ADD `reject_manager_at` integer;--> statement-breakpoint
ALTER TABLE `inv_productions` ADD `reject_leader_by` integer;--> statement-breakpoint
ALTER TABLE `inv_productions` ADD `reject_leader_at` integer;--> statement-breakpoint
CREATE INDEX `inv_productions_adukan_idx` ON `inv_productions` (`batch_id`);--> statement-breakpoint
ALTER TABLE `qc_sand_tests` ADD `secretary_ack_by` integer;--> statement-breakpoint
ALTER TABLE `qc_sand_tests` ADD `secretary_ack_at` integer;--> statement-breakpoint
ALTER TABLE `qc_sand_tests` ADD `manager_ack_by` integer;--> statement-breakpoint
ALTER TABLE `qc_sand_tests` ADD `manager_ack_at` integer;--> statement-breakpoint
ALTER TABLE `qc_sand_tests` ADD `leader_ack_by` integer;--> statement-breakpoint
ALTER TABLE `qc_sand_tests` ADD `leader_ack_at` integer;--> statement-breakpoint
ALTER TABLE `qc_sand_tests` ADD `edit_history` text DEFAULT '[]' NOT NULL;