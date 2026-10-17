CREATE TABLE `fin_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`grp` text NOT NULL,
	`system_key` text,
	`active` integer DEFAULT true NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fin_accounts_code_uq` ON `fin_accounts` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `fin_accounts_system_uq` ON `fin_accounts` (`system_key`);--> statement-breakpoint
CREATE TABLE `inv_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`date` text NOT NULL,
	`item_id` text NOT NULL,
	`qty` real NOT NULL,
	`unit_cost` integer DEFAULT 0 NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fin_bill_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`bill_id` text NOT NULL,
	`item_id` text,
	`account_id` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`qty` real NOT NULL,
	`unit` text DEFAULT '' NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `fin_bl_bill_idx` ON `fin_bill_lines` (`bill_id`);--> statement-breakpoint
CREATE TABLE `fin_bills` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`supplier_ref` text DEFAULT '' NOT NULL,
	`date` text NOT NULL,
	`due_date` text NOT NULL,
	`contact_id` text NOT NULL,
	`subtotal` integer DEFAULT 0 NOT NULL,
	`discount` integer DEFAULT 0 NOT NULL,
	`taxable` integer DEFAULT false NOT NULL,
	`tax_rate` real DEFAULT 0 NOT NULL,
	`tax` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`paid` integer DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`void` integer DEFAULT false NOT NULL,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fin_bills_number_uq` ON `fin_bills` (`number`);--> statement-breakpoint
CREATE INDEX `fin_bills_contact_idx` ON `fin_bills` (`contact_id`,`date`);--> statement-breakpoint
CREATE TABLE `fin_cash_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`cash_id` text NOT NULL,
	`account_id` text NOT NULL,
	`amount` integer NOT NULL,
	`memo` text DEFAULT '' NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `fin_cl_cash_idx` ON `fin_cash_lines` (`cash_id`);--> statement-breakpoint
CREATE TABLE `fin_cash_txns` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`account_id` text NOT NULL,
	`to_account_id` text,
	`contact_id` text,
	`amount` integer DEFAULT 0 NOT NULL,
	`memo` text DEFAULT '' NOT NULL,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fin_cash_number_uq` ON `fin_cash_txns` (`number`);--> statement-breakpoint
CREATE INDEX `fin_cash_date_idx` ON `fin_cash_txns` (`date`);--> statement-breakpoint
CREATE TABLE `fin_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text DEFAULT 'pelanggan' NOT NULL,
	`name` text NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`npwp` text DEFAULT '' NOT NULL,
	`term_days` integer DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `fin_contacts_name_idx` ON `fin_contacts` (`name`);--> statement-breakpoint
CREATE TABLE `ops_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`order_id` text NOT NULL,
	`date` text NOT NULL,
	`vehicle_id` text,
	`driver_id` text,
	`status` text DEFAULT 'dijadwalkan' NOT NULL,
	`departed_at` integer,
	`delivered_at` integer,
	`received_by` text DEFAULT '' NOT NULL,
	`proof_key` text,
	`note` text DEFAULT '' NOT NULL,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ops_deliveries_number_uq` ON `ops_deliveries` (`number`);--> statement-breakpoint
CREATE INDEX `ops_deliveries_date_idx` ON `ops_deliveries` (`date`,`status`);--> statement-breakpoint
CREATE INDEX `ops_deliveries_order_idx` ON `ops_deliveries` (`order_id`);--> statement-breakpoint
CREATE TABLE `ops_delivery_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`delivery_id` text NOT NULL,
	`order_line_id` text NOT NULL,
	`item_id` text NOT NULL,
	`qty` real NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ops_dl_delivery_idx` ON `ops_delivery_lines` (`delivery_id`);--> statement-breakpoint
CREATE INDEX `ops_dl_orderline_idx` ON `ops_delivery_lines` (`order_line_id`);--> statement-breakpoint
CREATE TABLE `ops_drivers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fin_invoice_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`item_id` text,
	`order_line_id` text,
	`account_id` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`qty` real NOT NULL,
	`unit` text DEFAULT '' NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `fin_il_invoice_idx` ON `fin_invoice_lines` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `fin_il_orderline_idx` ON `fin_invoice_lines` (`order_line_id`);--> statement-breakpoint
CREATE TABLE `fin_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`date` text NOT NULL,
	`due_date` text NOT NULL,
	`contact_id` text NOT NULL,
	`order_id` text,
	`subtotal` integer DEFAULT 0 NOT NULL,
	`discount` integer DEFAULT 0 NOT NULL,
	`ongkir` integer DEFAULT 0 NOT NULL,
	`taxable` integer DEFAULT false NOT NULL,
	`tax_rate` real DEFAULT 0 NOT NULL,
	`tax` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`paid` integer DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`void` integer DEFAULT false NOT NULL,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fin_invoices_number_uq` ON `fin_invoices` (`number`);--> statement-breakpoint
CREATE INDEX `fin_invoices_contact_idx` ON `fin_invoices` (`contact_id`,`date`);--> statement-breakpoint
CREATE INDEX `fin_invoices_order_idx` ON `fin_invoices` (`order_id`);--> statement-breakpoint
CREATE TABLE `fin_items` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'barang_jadi' NOT NULL,
	`unit` text DEFAULT 'pcs' NOT NULL,
	`sell_price` integer DEFAULT 0 NOT NULL,
	`buy_price` integer DEFAULT 0 NOT NULL,
	`track_stock` integer DEFAULT true NOT NULL,
	`min_stock` real DEFAULT 0 NOT NULL,
	`product_id` integer,
	`revenue_account_id` text,
	`active` integer DEFAULT true NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fin_items_code_uq` ON `fin_items` (`code`);--> statement-breakpoint
CREATE TABLE `fin_journal_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`journal_id` text NOT NULL,
	`date` text NOT NULL,
	`account_id` text NOT NULL,
	`debit` integer DEFAULT 0 NOT NULL,
	`credit` integer DEFAULT 0 NOT NULL,
	`memo` text DEFAULT '' NOT NULL,
	`contact_id` text,
	`sort` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `fin_jl_journal_idx` ON `fin_journal_lines` (`journal_id`);--> statement-breakpoint
CREATE INDEX `fin_jl_account_idx` ON `fin_journal_lines` (`account_id`,`date`);--> statement-breakpoint
CREATE TABLE `fin_journals` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`date` text NOT NULL,
	`memo` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_id` text,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `fin_journals_date_idx` ON `fin_journals` (`date`);--> statement-breakpoint
CREATE INDEX `fin_journals_source_idx` ON `fin_journals` (`source`,`source_id`);--> statement-breakpoint
CREATE TABLE `ops_order_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`item_id` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`qty` real NOT NULL,
	`unit` text DEFAULT '' NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ops_ol_order_idx` ON `ops_order_lines` (`order_id`);--> statement-breakpoint
CREATE TABLE `ops_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`date` text NOT NULL,
	`contact_id` text NOT NULL,
	`customer_ref` text DEFAULT '' NOT NULL,
	`project` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`maps_url` text DEFAULT '' NOT NULL,
	`site_contact` text DEFAULT '' NOT NULL,
	`requested_date` text,
	`status` text DEFAULT 'dikonfirmasi' NOT NULL,
	`ongkir` integer DEFAULT 0 NOT NULL,
	`discount` integer DEFAULT 0 NOT NULL,
	`taxable` integer DEFAULT false NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ops_orders_number_uq` ON `ops_orders` (`number`);--> statement-breakpoint
CREATE INDEX `ops_orders_status_idx` ON `ops_orders` (`status`,`date`);--> statement-breakpoint
CREATE TABLE `fin_payment_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_id` text NOT NULL,
	`bill_id` text NOT NULL,
	`amount` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `fin_pa_payment_idx` ON `fin_payment_allocations` (`payment_id`);--> statement-breakpoint
CREATE INDEX `fin_pa_bill_idx` ON `fin_payment_allocations` (`bill_id`);--> statement-breakpoint
CREATE TABLE `fin_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`date` text NOT NULL,
	`contact_id` text NOT NULL,
	`account_id` text NOT NULL,
	`amount` integer NOT NULL,
	`memo` text DEFAULT '' NOT NULL,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fin_payments_number_uq` ON `fin_payments` (`number`);--> statement-breakpoint
CREATE INDEX `fin_payments_contact_idx` ON `fin_payments` (`contact_id`);--> statement-breakpoint
CREATE TABLE `inv_production_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`production_id` text NOT NULL,
	`role` text NOT NULL,
	`item_id` text NOT NULL,
	`qty` real NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inv_pl_prod_idx` ON `inv_production_lines` (`production_id`);--> statement-breakpoint
CREATE TABLE `inv_productions` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`date` text NOT NULL,
	`labor_cost` integer DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fin_receipt_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_id` text NOT NULL,
	`invoice_id` text NOT NULL,
	`amount` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `fin_ra_receipt_idx` ON `fin_receipt_allocations` (`receipt_id`);--> statement-breakpoint
CREATE INDEX `fin_ra_invoice_idx` ON `fin_receipt_allocations` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `fin_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`date` text NOT NULL,
	`contact_id` text NOT NULL,
	`account_id` text NOT NULL,
	`amount` integer NOT NULL,
	`memo` text DEFAULT '' NOT NULL,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fin_receipts_number_uq` ON `fin_receipts` (`number`);--> statement-breakpoint
CREATE INDEX `fin_receipts_contact_idx` ON `fin_receipts` (`contact_id`);--> statement-breakpoint
CREATE TABLE `sys_sequences` (
	`key` text PRIMARY KEY NOT NULL,
	`value` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inv_stock_moves` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`date` text NOT NULL,
	`qty` real NOT NULL,
	`value` integer DEFAULT 0 NOT NULL,
	`source` text NOT NULL,
	`source_id` text,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inv_sm_item_idx` ON `inv_stock_moves` (`item_id`,`date`);--> statement-breakpoint
CREATE INDEX `inv_sm_source_idx` ON `inv_stock_moves` (`source`,`source_id`);--> statement-breakpoint
CREATE TABLE `ops_vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`plate` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`capacity` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `users` ADD `roles` text DEFAULT '["owner"]' NOT NULL;