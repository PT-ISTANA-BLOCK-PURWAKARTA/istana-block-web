-- MULAI BERSIH: menghapus SEMUA transaksi keuangan & operasional (data contoh MAUPUN data latihan/asli):
-- jurnal, faktur, penerimaan, pembelian, pembayaran, kas, pesanan, surat jalan, produksi, penyesuaian, stok, penomoran,
-- dan riwayat posisi truk (lacak).
-- Yang tetap: bagan akun, barang & harga, pelanggan/pemasok, armada, sopir, pengguna, pengaturan.
-- Data master contoh (pelanggan, pemasok, armada, sopir, barang berawalan "demo-") ikut dihapus.
--
-- Hanya untuk dijalankan SEKALI sebelum mulai mencatat transaksi sungguhan. Cadangkan database dulu.
DELETE FROM fin_journal_lines;
DELETE FROM fin_journals;
DELETE FROM fin_cash_lines;
DELETE FROM fin_cash_txns;
DELETE FROM fin_receipt_allocations;
DELETE FROM fin_receipts;
DELETE FROM fin_invoice_lines;
DELETE FROM fin_invoices;
DELETE FROM fin_payment_allocations;
DELETE FROM fin_payments;
DELETE FROM fin_bill_lines;
DELETE FROM fin_bills;
DELETE FROM inv_stock_moves;
DELETE FROM inv_adjustments;
DELETE FROM inv_production_lines;
DELETE FROM inv_productions;
DELETE FROM ops_delivery_lines;
DELETE FROM ops_deliveries;
DELETE FROM ops_order_lines;
DELETE FROM ops_orders;
DELETE FROM sys_sequences;
DELETE FROM ops_positions;
UPDATE users SET driver_id = NULL WHERE driver_id LIKE 'demo-%';
DELETE FROM fin_contacts WHERE id LIKE 'demo-%';
DELETE FROM ops_vehicles WHERE id LIKE 'demo-%';
DELETE FROM ops_drivers WHERE id LIKE 'demo-%';
DELETE FROM fin_items WHERE id LIKE 'demo-%';
