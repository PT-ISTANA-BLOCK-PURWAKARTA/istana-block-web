-- Paritas kolom dengan inventori-ops (migrasi 0025-0092): hanya ALTER ADD, tanpa DROP.
-- Padanan nama: ops camelCase -> web snake_case. Rujukan tiap kolom ada di docs/porting/PETA-GAP-PORTING.md.
ALTER TABLE `ops_vehicles` ADD `tag` text;--> statement-breakpoint
ALTER TABLE `ops_orders` ADD `is_internal` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ops_order_lines` ADD `loaded_qty` real;--> statement-breakpoint
ALTER TABLE `ops_order_lines` ADD `stock_key` text;--> statement-breakpoint
ALTER TABLE `ops_deliveries` ADD `load_note` text;--> statement-breakpoint
ALTER TABLE `ops_deliveries` ADD `loaded_by_name` text;--> statement-breakpoint
ALTER TABLE `ops_deliveries` ADD `arrival_corrected_by_name` text;--> statement-breakpoint
ALTER TABLE `ops_goods_receipts` ADD `test_skipped_by_name` text;--> statement-breakpoint
ALTER TABLE `ops_goods_receipts` ADD `settled_by` integer REFERENCES `users`(`id`) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `ops_goods_receipts` ADD `settled_by_name` text;--> statement-breakpoint
ALTER TABLE `ops_goods_receipts` ADD `settled_at` integer;--> statement-breakpoint
ALTER TABLE `ops_goods_receipts` ADD `original` text;--> statement-breakpoint
ALTER TABLE `inv_productions` ADD `mix_part` text;--> statement-breakpoint
ALTER TABLE `qc_product_specs` ADD `photo_key` text;--> statement-breakpoint
ALTER TABLE `qc_strength_tests` ADD `absorption` text;--> statement-breakpoint
ALTER TABLE `qc_strength_tests` ADD `absorption_on_certificate` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `qc_strength_tests` ADD `maker_signed_by` integer;--> statement-breakpoint
ALTER TABLE `qc_strength_tests` ADD `maker_signed_at` integer;--> statement-breakpoint
ALTER TABLE `qc_strength_samples` ADD `surface` text;--> statement-breakpoint
ALTER TABLE `ops_push_subscriptions` ADD `last_result` text;--> statement-breakpoint
ALTER TABLE `ops_push_subscriptions` ADD `last_sent_at` integer;--> statement-breakpoint
ALTER TABLE `ops_push_subscriptions` ADD `last_title` text;
