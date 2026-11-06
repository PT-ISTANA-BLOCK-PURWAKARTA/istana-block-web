-- Porting tabel yang belum ada di web (inventori-ops 0049-0092). CREATE only, tanpa DROP.
-- Konvensi web: id TEXT, waktu integer detik, foto *_keys (R2), JSON sebagai text.
CREATE TABLE `ops_customer_addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`label` text DEFAULT 'Utama' NOT NULL,
	`recipient_name` text DEFAULT '' NOT NULL,
	`recipient_phone` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`province` text DEFAULT '' NOT NULL,
	`latitude` real,
	`longitude` real,
	`maps_url` text DEFAULT '' NOT NULL,
	`delivery_note` text DEFAULT '' NOT NULL,
	`location_source` text,
	`location_confirmed_at` integer,
	`via_latitude` real,
	`via_longitude` real,
	`via_note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ops_cust_addr_contact_idx` ON `ops_customer_addresses` (`contact_id`);--> statement-breakpoint
CREATE TABLE `inv_transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`from_key` text NOT NULL,
	`to_key` text NOT NULL,
	`qty` real NOT NULL,
	`moved_at` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`moved_by_name` text,
	`photo_keys` text DEFAULT '[]' NOT NULL,
	`leader` text,
	`target` real,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inv_transfers_moved_idx` ON `inv_transfers` (`moved_at`);--> statement-breakpoint
CREATE TABLE `ops_driver_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`driver_id` text NOT NULL,
	`day` text NOT NULL,
	`status` text NOT NULL,
	`until_time` text,
	`note` text,
	`set_by` integer,
	`set_by_name` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ops_driver_sched_uq` ON `ops_driver_schedules` (`driver_id`,`day`);--> statement-breakpoint
CREATE TABLE `ops_fleet_expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_date` text NOT NULL,
	`vehicle_id` text,
	`vehicle_label` text,
	`driver_name` text,
	`kind` text NOT NULL,
	`item` text DEFAULT '' NOT NULL,
	`qty` real,
	`price` real,
	`total` real DEFAULT 0 NOT NULL,
	`shop` text,
	`mechanic` text,
	`place` text,
	`destination` text,
	`payment` text,
	`fund` text DEFAULT 'ib' NOT NULL,
	`note` text,
	`party` text,
	`photo_keys` text DEFAULT '[]' NOT NULL,
	`approval_status` text DEFAULT 'menunggu' NOT NULL,
	`approved_by` integer,
	`approved_by_name` text,
	`approved_at` integer,
	`approval_note` text,
	`source_key` text,
	`created_by` integer,
	`created_by_name` text,
	`updated_by_name` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ops_fleet_exp_date_idx` ON `ops_fleet_expenses` (`entry_date`);--> statement-breakpoint
CREATE INDEX `ops_fleet_exp_vehicle_idx` ON `ops_fleet_expenses` (`vehicle_id`);--> statement-breakpoint
CREATE TABLE `ops_payslips` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_name` text NOT NULL,
	`slip_date` text NOT NULL,
	`earnings` text DEFAULT '[]' NOT NULL,
	`deductions` text DEFAULT '[]' NOT NULL,
	`kasbon_note` text,
	`note` text,
	`signer_id` integer,
	`signer_name` text,
	`created_by` integer,
	`created_by_name` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ops_payslips_date_idx` ON `ops_payslips` (`slip_date`);--> statement-breakpoint
CREATE TABLE `inv_production_targets` (
	`key` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`unit` text NOT NULL,
	`target` real NOT NULL,
	`set_by` integer,
	`set_by_name` text,
	`set_at` integer NOT NULL,
	`history` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inv_production_target_reasons` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`work_date` text NOT NULL,
	`label` text NOT NULL,
	`target` real NOT NULL,
	`actual` real NOT NULL,
	`reason` text NOT NULL,
	`created_by` integer,
	`created_by_name` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inv_pt_reason_key_idx` ON `inv_production_target_reasons` (`key`,`work_date`);--> statement-breakpoint
CREATE TABLE `inv_production_deletions` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`ref_id` text,
	`work_date` text,
	`label` text NOT NULL,
	`qty` real,
	`unit` text,
	`snapshot` text DEFAULT '{}' NOT NULL,
	`reason` text,
	`deleted_by` integer,
	`deleted_by_name` text,
	`deleted_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inv_prod_del_at_idx` ON `inv_production_deletions` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `ops_delivery_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`issuer` text DEFAULT 'ib' NOT NULL,
	`seq` integer DEFAULT 0 NOT NULL,
	`number` text NOT NULL,
	`note_date` text NOT NULL,
	`po_number` text,
	`terms` text,
	`customer_name` text NOT NULL,
	`customer_phone` text,
	`address` text,
	`note` text,
	`items` text DEFAULT '[]' NOT NULL,
	`driver_name` text,
	`plate` text,
	`driver_id` text,
	`vehicle_id` text,
	`order_id` text,
	`order_po_number` text,
	`is_internal` integer DEFAULT 0 NOT NULL,
	`pickup` integer DEFAULT 0 NOT NULL,
	`signer_id` integer,
	`signer_name` text,
	`created_by` integer,
	`created_by_name` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ops_dn_number_uq` ON `ops_delivery_notes` (`issuer`,`number`);--> statement-breakpoint
CREATE INDEX `ops_dn_date_idx` ON `ops_delivery_notes` (`note_date`);--> statement-breakpoint
CREATE TABLE `ops_planned_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_name` text NOT NULL,
	`project` text,
	`expected_date` integer NOT NULL,
	`items` text DEFAULT '[]' NOT NULL,
	`note` text,
	`status` text DEFAULT 'rencana' NOT NULL,
	`quotation_id` text,
	`created_by` integer,
	`created_by_name` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ops_planned_date_idx` ON `ops_planned_orders` (`expected_date`);--> statement-breakpoint
CREATE TABLE `ops_quotations` (
	`id` text PRIMARY KEY NOT NULL,
	`seq` integer DEFAULT 0 NOT NULL,
	`number` text NOT NULL,
	`quote_date` integer NOT NULL,
	`project_name` text,
	`project_city` text,
	`customer_name` text NOT NULL,
	`customer_address` text,
	`customer_phone` text,
	`work` text,
	`location` text,
	`items` text DEFAULT '[]' NOT NULL,
	`terms` text DEFAULT '[]' NOT NULL,
	`bank_name` text,
	`bank_account` text,
	`signer_id` integer,
	`signer_name` text,
	`signer_title` text,
	`customer_sign_title` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by` integer,
	`created_by_name` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ops_quot_number_uq` ON `ops_quotations` (`number`);--> statement-breakpoint
CREATE INDEX `ops_quot_date_idx` ON `ops_quotations` (`quote_date`);--> statement-breakpoint
CREATE TABLE `ops_sales_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`seq` integer DEFAULT 0 NOT NULL,
	`number` text NOT NULL,
	`invoice_date` integer NOT NULL,
	`quotation_id` text,
	`order_id` text,
	`order_po_number` text,
	`customer_name` text NOT NULL,
	`customer_address` text,
	`customer_phone` text,
	`po_number` text,
	`items` text DEFAULT '[]' NOT NULL,
	`shipments` text DEFAULT '[]' NOT NULL,
	`ppn_percent` real DEFAULT 0 NOT NULL,
	`down_payment_percent` real,
	`note` text,
	`bank_name` text,
	`bank_account` text,
	`signer_id` integer,
	`signer_name` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`paid_amount` real,
	`paid_at` integer,
	`payment_method` text,
	`payment_note` text,
	`paid_by_name` text,
	`issuer` text DEFAULT 'ib' NOT NULL,
	`driver_name` text,
	`plate` text,
	`route` text,
	`ship_date` text,
	`created_by` integer,
	`created_by_name` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ops_sinv_number_uq` ON `ops_sales_invoices` (`number`);--> statement-breakpoint
CREATE INDEX `ops_sinv_date_idx` ON `ops_sales_invoices` (`invoice_date`);--> statement-breakpoint
CREATE TABLE `ops_uditch_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_date` text NOT NULL,
	`account` text NOT NULL,
	`direction` text NOT NULL,
	`item` text DEFAULT '' NOT NULL,
	`qty` real,
	`party` text,
	`price` real,
	`total` real DEFAULT 0 NOT NULL,
	`category` text,
	`note` text,
	`remark` text,
	`pic` text,
	`source_key` text,
	`created_by` integer,
	`created_by_name` text,
	`updated_by_name` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ops_uditch_date_idx` ON `ops_uditch_entries` (`entry_date`);--> statement-breakpoint
CREATE INDEX `ops_uditch_account_idx` ON `ops_uditch_entries` (`account`);
