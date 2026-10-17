-- Menghapus SEMUA data contoh (id berawalan "demo-") beserta jurnal, stok, dan baris turunannya,
-- lalu menyusun ulang penomoran dari dokumen yang tersisa. Data asli tidak tersentuh.
--
-- Pengaman: berhenti bila ada transaksi BUKAN contoh yang memakai pelanggan, barang, pesanan, armada, atau faktur contoh
-- (mis. latihan yang dibuat di atas data contoh). Untuk kasus itu pakai seed/erp-mulai-bersih.sql.
DROP TABLE IF EXISTS _demo_guard;
CREATE TABLE _demo_guard (n INTEGER CHECK (n = 0));
INSERT INTO _demo_guard SELECT
  (SELECT count(*) FROM ops_orders WHERE id NOT LIKE 'demo-%' AND contact_id LIKE 'demo-%')
  + (SELECT count(*) FROM ops_order_lines WHERE order_id NOT LIKE 'demo-%' AND item_id LIKE 'demo-%')
  + (SELECT count(*) FROM ops_deliveries WHERE id NOT LIKE 'demo-%' AND (order_id LIKE 'demo-%' OR vehicle_id LIKE 'demo-%' OR driver_id LIKE 'demo-%'))
  + (SELECT count(*) FROM fin_invoices WHERE id NOT LIKE 'demo-%' AND (contact_id LIKE 'demo-%' OR order_id LIKE 'demo-%'))
  + (SELECT count(*) FROM fin_invoice_lines WHERE invoice_id NOT LIKE 'demo-%' AND (item_id LIKE 'demo-%' OR order_line_id LIKE 'demo-%'))
  + (SELECT count(*) FROM fin_receipts WHERE id NOT LIKE 'demo-%' AND contact_id LIKE 'demo-%')
  + (SELECT count(*) FROM fin_bills WHERE id NOT LIKE 'demo-%' AND contact_id LIKE 'demo-%')
  + (SELECT count(*) FROM fin_bill_lines WHERE bill_id NOT LIKE 'demo-%' AND item_id LIKE 'demo-%')
  + (SELECT count(*) FROM fin_payments WHERE id NOT LIKE 'demo-%' AND contact_id LIKE 'demo-%')
  + (SELECT count(*) FROM fin_cash_txns WHERE id NOT LIKE 'demo-%' AND contact_id LIKE 'demo-%')
  + (SELECT count(*) FROM fin_receipt_allocations WHERE receipt_id NOT LIKE 'demo-%' AND invoice_id LIKE 'demo-%')
  + (SELECT count(*) FROM fin_payment_allocations WHERE payment_id NOT LIKE 'demo-%' AND bill_id LIKE 'demo-%')
  + (SELECT count(*) FROM fin_journal_lines WHERE contact_id LIKE 'demo-%' AND journal_id NOT IN (SELECT id FROM fin_journals WHERE id LIKE 'demo-%' OR coalesce(source_id, '') LIKE 'demo-%'))
  + (SELECT count(*) FROM inv_stock_moves WHERE item_id LIKE 'demo-%' AND id NOT LIKE 'demo-%' AND coalesce(source_id, '') NOT LIKE 'demo-%');
DROP TABLE _demo_guard;
DELETE FROM fin_journal_lines WHERE journal_id IN (SELECT id FROM fin_journals WHERE id LIKE 'demo-%' OR coalesce(source_id, '') LIKE 'demo-%');
DELETE FROM fin_journals WHERE id IN (SELECT id FROM fin_journals WHERE id LIKE 'demo-%' OR coalesce(source_id, '') LIKE 'demo-%');
DELETE FROM inv_stock_moves WHERE id LIKE 'demo-%' OR coalesce(source_id, '') LIKE 'demo-%';
DELETE FROM fin_cash_lines WHERE id LIKE 'demo-%' OR cash_id LIKE 'demo-%';
DELETE FROM fin_cash_txns WHERE id LIKE 'demo-%';
DELETE FROM fin_receipt_allocations WHERE id LIKE 'demo-%' OR receipt_id LIKE 'demo-%';
DELETE FROM fin_receipts WHERE id LIKE 'demo-%';
DELETE FROM fin_invoice_lines WHERE id LIKE 'demo-%' OR invoice_id LIKE 'demo-%';
DELETE FROM fin_invoices WHERE id LIKE 'demo-%';
DELETE FROM fin_payment_allocations WHERE id LIKE 'demo-%' OR payment_id LIKE 'demo-%';
DELETE FROM fin_payments WHERE id LIKE 'demo-%';
DELETE FROM fin_bill_lines WHERE id LIKE 'demo-%' OR bill_id LIKE 'demo-%';
DELETE FROM fin_bills WHERE id LIKE 'demo-%';
DELETE FROM inv_adjustments WHERE id LIKE 'demo-%';
DELETE FROM inv_production_lines WHERE id LIKE 'demo-%' OR production_id LIKE 'demo-%';
DELETE FROM inv_productions WHERE id LIKE 'demo-%';
DELETE FROM ops_delivery_lines WHERE id LIKE 'demo-%' OR delivery_id LIKE 'demo-%';
DELETE FROM ops_deliveries WHERE id LIKE 'demo-%';
DELETE FROM ops_order_lines WHERE id LIKE 'demo-%' OR order_id LIKE 'demo-%';
DELETE FROM ops_orders WHERE id LIKE 'demo-%';
DELETE FROM fin_contacts WHERE id LIKE 'demo-%';
DELETE FROM ops_vehicles WHERE id LIKE 'demo-%';
DELETE FROM ops_drivers WHERE id LIKE 'demo-%';
DELETE FROM fin_items WHERE id LIKE 'demo-%'
  AND NOT EXISTS (SELECT 1 FROM inv_stock_moves x WHERE x.item_id = fin_items.id)
  AND NOT EXISTS (SELECT 1 FROM ops_order_lines x WHERE x.item_id = fin_items.id)
  AND NOT EXISTS (SELECT 1 FROM inv_production_lines x WHERE x.item_id = fin_items.id)
  AND NOT EXISTS (SELECT 1 FROM inv_adjustments x WHERE x.item_id = fin_items.id)
  AND NOT EXISTS (SELECT 1 FROM fin_invoice_lines x WHERE x.item_id = fin_items.id)
  AND NOT EXISTS (SELECT 1 FROM fin_bill_lines x WHERE x.item_id = fin_items.id);
DELETE FROM sys_sequences;
INSERT INTO sys_sequences (key, value)
  SELECT substr(number, 1, length(number) - 5), max(CAST(substr(number, -4) AS INTEGER)) FROM fin_invoices WHERE number LIKE '%/____/____' GROUP BY 1
  ON CONFLICT(key) DO UPDATE SET value = max(value, excluded.value);
INSERT INTO sys_sequences (key, value)
  SELECT substr(number, 1, length(number) - 5), max(CAST(substr(number, -4) AS INTEGER)) FROM fin_receipts WHERE number LIKE '%/____/____' GROUP BY 1
  ON CONFLICT(key) DO UPDATE SET value = max(value, excluded.value);
INSERT INTO sys_sequences (key, value)
  SELECT substr(number, 1, length(number) - 5), max(CAST(substr(number, -4) AS INTEGER)) FROM fin_bills WHERE number LIKE '%/____/____' GROUP BY 1
  ON CONFLICT(key) DO UPDATE SET value = max(value, excluded.value);
INSERT INTO sys_sequences (key, value)
  SELECT substr(number, 1, length(number) - 5), max(CAST(substr(number, -4) AS INTEGER)) FROM fin_payments WHERE number LIKE '%/____/____' GROUP BY 1
  ON CONFLICT(key) DO UPDATE SET value = max(value, excluded.value);
INSERT INTO sys_sequences (key, value)
  SELECT substr(number, 1, length(number) - 5), max(CAST(substr(number, -4) AS INTEGER)) FROM fin_cash_txns WHERE number LIKE '%/____/____' GROUP BY 1
  ON CONFLICT(key) DO UPDATE SET value = max(value, excluded.value);
INSERT INTO sys_sequences (key, value)
  SELECT substr(number, 1, length(number) - 5), max(CAST(substr(number, -4) AS INTEGER)) FROM fin_journals WHERE number LIKE '%/____/____' GROUP BY 1
  ON CONFLICT(key) DO UPDATE SET value = max(value, excluded.value);
INSERT INTO sys_sequences (key, value)
  SELECT substr(number, 1, length(number) - 5), max(CAST(substr(number, -4) AS INTEGER)) FROM ops_orders WHERE number LIKE '%/____/____' GROUP BY 1
  ON CONFLICT(key) DO UPDATE SET value = max(value, excluded.value);
INSERT INTO sys_sequences (key, value)
  SELECT substr(number, 1, length(number) - 5), max(CAST(substr(number, -4) AS INTEGER)) FROM ops_deliveries WHERE number LIKE '%/____/____' GROUP BY 1
  ON CONFLICT(key) DO UPDATE SET value = max(value, excluded.value);
INSERT INTO sys_sequences (key, value)
  SELECT substr(number, 1, length(number) - 5), max(CAST(substr(number, -4) AS INTEGER)) FROM inv_productions WHERE number LIKE '%/____/____' GROUP BY 1
  ON CONFLICT(key) DO UPDATE SET value = max(value, excluded.value);
INSERT INTO sys_sequences (key, value)
  SELECT substr(number, 1, length(number) - 5), max(CAST(substr(number, -4) AS INTEGER)) FROM inv_adjustments WHERE number LIKE '%/____/____' GROUP BY 1
  ON CONFLICT(key) DO UPDATE SET value = max(value, excluded.value);
