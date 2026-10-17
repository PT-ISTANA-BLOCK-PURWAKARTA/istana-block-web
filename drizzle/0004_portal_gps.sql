-- Portal /internal: akun lapangan (nomor HP + PIN, sopir), pelacakan truk (ID perangkat GPS & riwayat posisi).
-- Tabel users dibuat ulang karena email & password kini boleh kosong untuk akun lapangan; data akun lama disalin utuh.
CREATE TABLE `ops_positions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vehicle_id` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`speed` real,
	`heading` real,
	`accuracy` real,
	`at` integer NOT NULL,
	`received_at` integer NOT NULL,
	`source` text DEFAULT 'gps' NOT NULL,
	`user_id` integer
);
--> statement-breakpoint
CREATE INDEX `ops_positions_vehicle_at` ON `ops_positions` (`vehicle_id`,`at`);--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text,
	`name` text NOT NULL,
	`password_hash` text,
	`phone` text,
	`pin_hash` text,
	`driver_id` text,
	`roles` text DEFAULT '["owner"]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "email", "name", "password_hash", "phone", "pin_hash", "driver_id", "roles", "created_at", "updated_at") SELECT "id", "email", "name", "password_hash", NULL, NULL, NULL, "roles", "created_at", "updated_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_phone_unique` ON `users` (`phone`);--> statement-breakpoint
ALTER TABLE `ops_vehicles` ADD `gps_device_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `ops_vehicles_gps_device` ON `ops_vehicles` (`gps_device_id`);