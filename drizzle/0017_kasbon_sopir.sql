ALTER TABLE `ops_kasbon_entries` ADD `category` text;
ALTER TABLE `ops_kasbon_entries` ADD `pay_method` text;
ALTER TABLE `ops_kasbon_entries` ADD `funded_by` text;
ALTER TABLE `ops_kasbon_entries` ADD `payslip_id` text;
ALTER TABLE `ops_kasbon_entries` ADD `is_driver` integer DEFAULT 0 NOT NULL;
ALTER TABLE `ops_payslips` ADD `pay_method` text;
