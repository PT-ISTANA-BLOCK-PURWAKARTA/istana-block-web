DROP INDEX IF EXISTS `fin_contacts_code_idx`;
ALTER TABLE `fin_cash_lines` DROP COLUMN `project_id`;
ALTER TABLE `fin_cash_txns` DROP COLUMN `status`;
ALTER TABLE `fin_cash_txns` DROP COLUMN `project_id`;
ALTER TABLE `fin_contacts` DROP COLUMN `code`;
