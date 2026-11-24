ALTER TABLE `qc_mix_designs` ADD `scope` text DEFAULT 'paving' NOT NULL;
ALTER TABLE `qc_mix_logs` ADD `scope` text DEFAULT 'paving' NOT NULL;
ALTER TABLE `qc_mix_logs` ADD `leader` text;
ALTER TABLE `qc_strength_tests` ADD `scope` text DEFAULT 'paving' NOT NULL;
CREATE TABLE `qc_downtimes` (`id` text PRIMARY KEY NOT NULL, `work_date` text NOT NULL, `scope` text DEFAULT 'beton' NOT NULL, `area` text, `start_time` text, `end_time` text, `minutes` integer NOT NULL, `reasons` text DEFAULT '[]' NOT NULL, `workers_short` integer, `note` text DEFAULT '' NOT NULL, `created_by` integer, `created_by_name` text, `created_at` integer DEFAULT (unixepoch()) NOT NULL, `updated_at` integer DEFAULT (unixepoch()) NOT NULL);
CREATE INDEX `qc_dt_date_idx` ON `qc_downtimes` (`work_date`,`scope`);
