-- Rollback 0027: hapus catatan tutup buku (kunci transaksi fin_lock_date di pengaturan tidak diubah).
DROP INDEX IF EXISTS `fin_period_closes_period_idx`;
DROP TABLE IF EXISTS `fin_period_closes`;
