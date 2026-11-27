-- Rollback 0025: hapus faktur saldo awal hasil impor lalu kolom & tabelnya (jalankan manual bila perlu).
DELETE FROM fin_invoices WHERE opening_batch_id IS NOT NULL;
DELETE FROM fin_bills WHERE opening_batch_id IS NOT NULL;
DROP INDEX IF EXISTS fin_invoices_ext_ref_uq;
DROP INDEX IF EXISTS fin_bills_ext_ref_uq;
DROP INDEX IF EXISTS fin_invoices_opening_idx;
DROP INDEX IF EXISTS fin_bills_opening_idx;
ALTER TABLE fin_invoices DROP COLUMN opening_batch_id;
ALTER TABLE fin_invoices DROP COLUMN ext_ref;
ALTER TABLE fin_bills DROP COLUMN opening_batch_id;
ALTER TABLE fin_bills DROP COLUMN ext_ref;
DROP TABLE IF EXISTS fin_opening_batches;
