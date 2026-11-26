-- Data app.kirimistanablock yang belum punya tabel di web: stok maksimal per kode stok, harga pokok/jual precast,
-- kontrabon U-Ditch, stok opname & mutasi stok per kode stok (U-Ditch/tutup). Dibuat IF NOT EXISTS: sinkron data
-- (scripts/sinkron-lengkap-ke-web.mjs di repo kirim) memuat perintah yang sama.
CREATE TABLE IF NOT EXISTS `ops_stock_plans` (
	`key` text PRIMARY KEY NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`unit` text DEFAULT '' NOT NULL,
	`max_stock` real,
	`project_extra` real,
	`project_name` text,
	`project_until` text,
	`set_by` integer,
	`set_by_name` text,
	`set_at` integer
);
CREATE TABLE IF NOT EXISTS `ops_product_prices` (
	`id` text PRIMARY KEY NOT NULL,
	`line` text DEFAULT '' NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`per_kg_cost` real,
	`mesh_cost` real,
	`other_pct` real,
	`sell_price` real,
	`updated_by_name` text,
	`updated_at` integer
);
CREATE TABLE IF NOT EXISTS `ops_uditch_kontrabon` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`note` text,
	`position` integer DEFAULT 0 NOT NULL,
	`updated_by_name` text,
	`created_at` integer,
	`updated_at` integer
);
CREATE TABLE IF NOT EXISTS `ops_stock_key_counts` (
	`id` text PRIMARY KEY NOT NULL,
	`stock_key` text NOT NULL,
	`quantity` real DEFAULT 0 NOT NULL,
	`counted_at` integer,
	`note` text,
	`counted_by_name` text,
	`created_by` integer,
	`created_at` integer
);
CREATE INDEX IF NOT EXISTS `ops_skc_key_idx` ON `ops_stock_key_counts` (`stock_key`, `counted_at`);
CREATE TABLE IF NOT EXISTS `ops_stock_key_moves` (
	`id` text PRIMARY KEY NOT NULL,
	`stock_key` text NOT NULL,
	`direction` text NOT NULL,
	`reason` text,
	`quantity` real DEFAULT 0 NOT NULL,
	`moved_at` integer,
	`party` text,
	`note` text,
	`moved_by_name` text,
	`created_by` integer,
	`created_at` integer
);
CREATE INDEX IF NOT EXISTS `ops_skm_key_idx` ON `ops_stock_key_moves` (`stock_key`, `moved_at`);
