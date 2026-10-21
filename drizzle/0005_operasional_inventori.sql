-- Port aplikasi inventori-ops ke menu Operasional: jejak PO (hapus/batal/bayar), status kirim diperluas (dimuat, tiba, tertunda),
-- bukti & tautan lacak publik, notifikasi, push, piket, log aktivitas & backup, QC (mix desain, uji kuat tekan, uji pasir),
-- barang masuk, kalender rapat/training, rekap ISO. Tabel lama hanya ditambah kolom (ALTER ... ADD); tidak ada tabel yang dibuat ulang
-- dan tidak ada data yang dihapus. Kolom status pengiriman tetap teks, jadi nilai lama (dijadwalkan/berangkat/terkirim/batal) tetap sah.
CREATE TABLE `ops_activity_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer DEFAULT (unixepoch()) NOT NULL,
	`user_id` integer,
	`user_name` text,
	`role` text,
	`action` text NOT NULL,
	`label` text NOT NULL,
	`summary` text,
	`details` text,
	`success` integer DEFAULT true NOT NULL,
	`ip` text,
	`device` text
);
--> statement-breakpoint
CREATE INDEX `ops_al_at_idx` ON `ops_activity_logs` (`at`);--> statement-breakpoint
CREATE INDEX `ops_al_user_idx` ON `ops_activity_logs` (`user_id`,`at`);--> statement-breakpoint
CREATE TABLE `ops_backup_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`at` integer DEFAULT (unixepoch()) NOT NULL,
	`user_id` integer,
	`user_name` text,
	`folder` text,
	`tables_count` integer DEFAULT 0 NOT NULL,
	`rows_count` integer DEFAULT 0 NOT NULL,
	`photos_count` integer DEFAULT 0 NOT NULL,
	`new_photos_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ops_br_at_idx` ON `ops_backup_runs` (`at`);--> statement-breakpoint
CREATE TABLE `ops_calendar_events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`type` text DEFAULT 'rapat' NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer,
	`location` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`reminder_minutes` text DEFAULT '[]' NOT NULL,
	`series_id` text,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ops_ce_start_idx` ON `ops_calendar_events` (`start_at`);--> statement-breakpoint
CREATE INDEX `ops_ce_series_idx` ON `ops_calendar_events` (`series_id`);--> statement-breakpoint
CREATE TABLE `ops_calendar_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`user_id` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ops_cp_event_user_uq` ON `ops_calendar_participants` (`event_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `ops_cp_user_idx` ON `ops_calendar_participants` (`user_id`);--> statement-breakpoint
CREATE TABLE `ops_calendar_reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`minutes_before` integer NOT NULL,
	`remind_at` integer NOT NULL,
	`sent_at` integer
);
--> statement-breakpoint
CREATE INDEX `ops_cr_due_idx` ON `ops_calendar_reminders` (`sent_at`,`remind_at`);--> statement-breakpoint
CREATE INDEX `ops_cr_event_idx` ON `ops_calendar_reminders` (`event_id`);--> statement-breakpoint
CREATE TABLE `ops_calendar_results` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`leader` text DEFAULT '' NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`attendees` text DEFAULT '[]' NOT NULL,
	`guests` text DEFAULT '' NOT NULL,
	`duration_hours` real,
	`evaluation` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`files` text DEFAULT '[]' NOT NULL,
	`filled_by` integer,
	`filled_by_name` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ops_cres_event_uq` ON `ops_calendar_results` (`event_id`);--> statement-breakpoint
CREATE TABLE `ops_delivery_history` (
	`id` text PRIMARY KEY NOT NULL,
	`delivery_id` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`changed_by` integer,
	`changed_by_driver` text,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ops_dh_delivery_idx` ON `ops_delivery_history` (`delivery_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ops_delivery_proofs` (
	`id` text PRIMARY KEY NOT NULL,
	`delivery_id` text NOT NULL,
	`kind` text DEFAULT 'photo' NOT NULL,
	`file_key` text NOT NULL,
	`original_name` text DEFAULT '' NOT NULL,
	`created_by` integer,
	`created_by_driver` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ops_dp_delivery_idx` ON `ops_delivery_proofs` (`delivery_id`);--> statement-breakpoint
CREATE TABLE `ops_duty_shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`user_name` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`handover_note` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ops_ds_user_idx` ON `ops_duty_shifts` (`user_id`,`ended_at`);--> statement-breakpoint
CREATE INDEX `ops_ds_started_idx` ON `ops_duty_shifts` (`started_at`);--> statement-breakpoint
CREATE TABLE `ops_goods_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`received_at` integer NOT NULL,
	`category` text DEFAULT 'bahan_baku' NOT NULL,
	`item_name` text NOT NULL,
	`tag` text,
	`supplier` text,
	`quarry` text,
	`quantity` real,
	`unit` text DEFAULT 'm³' NOT NULL,
	`vehicle_plate` text,
	`driver_name` text,
	`delivery_note_no` text,
	`delivery_mode` text,
	`expedition_name` text,
	`has_brangkal` integer,
	`status` text DEFAULT 'diterima' NOT NULL,
	`photo_keys` text DEFAULT '[]' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`tier` integer,
	`quality_note` text,
	`quality_by` integer,
	`quality_at` integer,
	`speed_rating` integer,
	`delivery_note` text,
	`delivery_by` integer,
	`delivery_at` integer,
	`price_rating` integer,
	`price_note` text,
	`price_by` integer,
	`price_at` integer,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ops_gr_date_idx` ON `ops_goods_receipts` (`received_at`);--> statement-breakpoint
CREATE INDEX `ops_gr_item_idx` ON `ops_goods_receipts` (`item_name`);--> statement-breakpoint
CREATE TABLE `iso_records` (
	`id` text PRIMARY KEY NOT NULL,
	`form_code` text NOT NULL,
	`kind` text DEFAULT 'record' NOT NULL,
	`record_date` text NOT NULL,
	`source_key` text,
	`number` text,
	`data` text NOT NULL,
	`history` text DEFAULT '[]' NOT NULL,
	`created_by` integer,
	`created_by_name` text,
	`updated_by_name` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `iso_form_date_idx` ON `iso_records` (`form_code`,`kind`,`record_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `iso_form_source_uq` ON `iso_records` (`form_code`,`source_key`);--> statement-breakpoint
CREATE TABLE `qc_mix_designs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`layer` text NOT NULL,
	`product` text NOT NULL,
	`materials` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'diajukan' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_by` integer,
	`approved_by` integer,
	`approved_at` integer,
	`review_note` text,
	`retired_reason` text,
	`retired_by` integer,
	`retired_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `qc_md_status_idx` ON `qc_mix_designs` (`status`,`layer`);--> statement-breakpoint
CREATE TABLE `qc_mix_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`work_date` text NOT NULL,
	`layer` text NOT NULL,
	`product` text NOT NULL,
	`mix_design_id` text,
	`approved_materials` text NOT NULL,
	`actual_materials` text NOT NULL,
	`mixing_count` real,
	`boards` real,
	`square_meters` real,
	`rejects` real,
	`status` text DEFAULT 'sesuai' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`review_status` text DEFAULT 'menunggu' NOT NULL,
	`review_note` text,
	`created_by` integer,
	`manager_signed_by` integer,
	`manager_signed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `qc_ml_date_idx` ON `qc_mix_logs` (`work_date`,`layer`);--> statement-breakpoint
CREATE TABLE `ops_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`ref_id` text DEFAULT '' NOT NULL,
	`title` text NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`read_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ops_notif_read_idx` ON `ops_notifications` (`read_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `ops_notif_ref_idx` ON `ops_notifications` (`kind`,`ref_id`);--> statement-breakpoint
CREATE TABLE `ops_order_deletions` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`number` text NOT NULL,
	`customer_name` text DEFAULT '' NOT NULL,
	`customer_phone` text DEFAULT '' NOT NULL,
	`reason` text NOT NULL,
	`snapshot` text NOT NULL,
	`deleted_by` integer,
	`deleted_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ops_order_deletions_at_idx` ON `ops_order_deletions` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `ops_order_deletions_number_idx` ON `ops_order_deletions` (`number`);--> statement-breakpoint
CREATE TABLE `ops_push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`user_agent` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ops_push_endpoint_uq` ON `ops_push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE INDEX `ops_push_user_idx` ON `ops_push_subscriptions` (`user_id`);--> statement-breakpoint
CREATE TABLE `qc_sand_tests` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_id` text,
	`status` text DEFAULT 'selesai' NOT NULL,
	`tested_at` integer NOT NULL,
	`completed_at` integer,
	`supplier` text,
	`quarry` text,
	`sand_type` text NOT NULL,
	`reading_unit` text DEFAULT 'cm' NOT NULL,
	`sand_height` real,
	`silt_height` real,
	`silt_percent` real,
	`max_silt_percent` real DEFAULT 10 NOT NULL,
	`decision` text,
	`start_photo_key` text,
	`photo_key` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` integer,
	`completed_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `qc_sand_date_idx` ON `qc_sand_tests` (`tested_at`);--> statement-breakpoint
CREATE INDEX `qc_sand_receipt_idx` ON `qc_sand_tests` (`receipt_id`);--> statement-breakpoint
CREATE INDEX `qc_sand_status_idx` ON `qc_sand_tests` (`status`);--> statement-breakpoint
CREATE TABLE `qc_strength_samples` (
	`id` text PRIMARY KEY NOT NULL,
	`test_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`sample_name` text NOT NULL,
	`made_at` text,
	`tested_at` text,
	`weight_kg` real,
	`area_cm2` real,
	`max_load_kn` real
);
--> statement-breakpoint
CREATE INDEX `qc_ss_test_idx` ON `qc_strength_samples` (`test_id`);--> statement-breakpoint
CREATE TABLE `qc_strength_tests` (
	`id` text PRIMARY KEY NOT NULL,
	`report_date` text NOT NULL,
	`company_name` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`concrete_grade` text NOT NULL,
	`addressed_to` text DEFAULT '' NOT NULL,
	`composition` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`review_status` text DEFAULT 'menunggu' NOT NULL,
	`review_note` text,
	`created_by` integer,
	`lab_signed_by` integer,
	`lab_signed_at` integer,
	`leader_signed_by` integer,
	`leader_signed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `qc_st_date_idx` ON `qc_strength_tests` (`report_date`);--> statement-breakpoint
CREATE TABLE `ops_tracking_links` (
	`id` text PRIMARY KEY NOT NULL,
	`delivery_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`last_accessed_at` integer,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ops_tl_token_uq` ON `ops_tracking_links` (`token_hash`);--> statement-breakpoint
CREATE INDEX `ops_tl_delivery_idx` ON `ops_tracking_links` (`delivery_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `signature_key` text;--> statement-breakpoint
ALTER TABLE `ops_deliveries` ADD `loaded_at` integer;--> statement-breakpoint
ALTER TABLE `ops_deliveries` ADD `arrived_at` integer;--> statement-breakpoint
ALTER TABLE `ops_deliveries` ADD `delay_reason` text;--> statement-breakpoint
ALTER TABLE `ops_drivers` ADD `license_no` text;--> statement-breakpoint
ALTER TABLE `ops_drivers` ADD `license_expiry` text;--> statement-breakpoint
ALTER TABLE `ops_orders` ADD `external_ref` text;--> statement-breakpoint
ALTER TABLE `ops_orders` ADD `payment_status` text;--> statement-breakpoint
ALTER TABLE `ops_orders` ADD `payment_confirmed_by` integer;--> statement-breakpoint
ALTER TABLE `ops_orders` ADD `payment_confirmed_at` integer;--> statement-breakpoint
ALTER TABLE `ops_orders` ADD `cancel_reason` text;--> statement-breakpoint
ALTER TABLE `ops_orders` ADD `cancelled_by` integer;--> statement-breakpoint
ALTER TABLE `ops_orders` ADD `cancelled_at` integer;--> statement-breakpoint
CREATE INDEX `ops_orders_external_idx` ON `ops_orders` (`external_ref`);--> statement-breakpoint
ALTER TABLE `inv_productions` ADD `category` text;--> statement-breakpoint
ALTER TABLE `inv_productions` ADD `batch_code` text;--> statement-breakpoint
ALTER TABLE `inv_productions` ADD `leader` text;--> statement-breakpoint
ALTER TABLE `inv_productions` ADD `target` real;--> statement-breakpoint
ALTER TABLE `inv_productions` ADD `cement_bags` real;--> statement-breakpoint
ALTER TABLE `inv_productions` ADD `boards` real;--> statement-breakpoint
ALTER TABLE `inv_productions` ADD `rejects` real;--> statement-breakpoint
ALTER TABLE `inv_productions` ADD `issues` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `inv_productions` ADD `photo_key` text;--> statement-breakpoint
CREATE INDEX `inv_productions_batch_idx` ON `inv_productions` (`batch_code`);--> statement-breakpoint
ALTER TABLE `ops_vehicles` ADD `stnk_expiry` text;--> statement-breakpoint
ALTER TABLE `ops_vehicles` ADD `kir_expiry` text;