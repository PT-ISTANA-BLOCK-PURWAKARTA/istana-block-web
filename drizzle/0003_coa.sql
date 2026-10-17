-- Bagan akun bawaan untuk pabrik produk beton. Nama dan kode boleh diubah dari /keuangan/akun;
-- akun dengan system_key dipakai jurnal otomatis sehingga tidak bisa dihapus.
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_1-1100','1-1100','Kas','kas_bank','kas','');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_1-1200','1-1200','Kas Kecil Operasional','kas_bank',NULL,'');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_1-1300','1-1300','Bank Operasional','kas_bank','bank','Ganti nama sesuai rekening, mis. Bank BCA a/n PT Istana Block Purwakarta.');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_1-2100','1-2100','Piutang Usaha','piutang','piutang','');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_1-2200','1-2200','Piutang Lain-lain','piutang',NULL,'');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_1-3100','1-3100','Persediaan Barang Jadi','persediaan','persediaan_jadi','');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_1-3200','1-3200','Persediaan Bahan Baku','persediaan','persediaan_bahan','');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_1-4100','1-4100','PPN Masukan','aset_lancar_lain','ppn_masukan','');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_1-4200','1-4200','Uang Muka Pembelian','aset_lancar_lain','uang_muka_pembelian','');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_1-4300','1-4300','Biaya Dibayar di Muka','aset_lancar_lain',NULL,'');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_1-5100','1-5100','Tanah','aset_tetap',NULL,'');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_1-5200','1-5200','Bangunan Pabrik','aset_tetap',NULL,'');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_1-5300','1-5300','Mesin & Cetakan','aset_tetap',NULL,'');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_1-5400','1-5400','Kendaraan','aset_tetap',NULL,'');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_1-5500','1-5500','Peralatan Kantor','aset_tetap',NULL,'');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_1-6100','1-6100','Akumulasi Penyusutan','akum_penyusutan',NULL,'');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_2-1100','2-1100','Hutang Usaha','hutang_usaha','hutang','');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_2-2100','2-2100','PPN Keluaran','hutang_lain','ppn_keluaran','');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_2-2200','2-2200','Uang Muka Pelanggan','hutang_lain','uang_muka_pelanggan','');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_2-2300','2-2300','Hutang Gaji','hutang_lain',NULL,'');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_2-2400','2-2400','Hutang Pajak Lainnya','hutang_lain',NULL,'');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_2-3100','2-3100','Hutang Bank','hutang_lain',NULL,'');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_3-1000','3-1000','Modal Disetor','modal','modal','');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_3-2000','3-2000','Laba Ditahan','modal','laba_ditahan','');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_3-3000','3-3000','Ekuitas Saldo Awal','modal','saldo_awal','Lawan akun saat memasukkan saldo awal.');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_3-4000','3-4000','Prive / Dividen','modal',NULL,'');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_4-1100','4-1100','Penjualan Produk Beton','pendapatan','penjualan','');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_4-1200','4-1200','Pendapatan Jasa Pemasangan','pendapatan','pendapatan_jasa','');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_4-1300','4-1300','Pendapatan Ongkos Kirim','pendapatan','pendapatan_ongkir','');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_4-1900','4-1900','Potongan Penjualan','pendapatan','potongan_penjualan','Akun pengurang penjualan (saldo normal debit).');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_5-1100','5-1100','Harga Pokok Penjualan','hpp','hpp','');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_5-1200','5-1200','Selisih Persediaan','hpp','selisih_persediaan','');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_6-1100','6-1100','Upah Produksi','beban','upah_produksi','');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_6-1200','6-1200','Gaji Karyawan','beban',NULL,'');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_6-2100','6-2100','BBM & Tol Armada','beban',NULL,'');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_6-2200','6-2200','Perawatan Kendaraan','beban',NULL,'');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_6-2300','6-2300','Uang Jalan Sopir','beban',NULL,'');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_6-3100','6-3100','Listrik & Air','beban',NULL,'');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_6-3200','6-3200','Perawatan Mesin','beban',NULL,'');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_6-4100','6-4100','Sewa','beban',NULL,'');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_6-4200','6-4200','Telepon & Internet','beban',NULL,'');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_6-4300','6-4300','Alat Tulis & Kantor','beban',NULL,'');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_6-4400','6-4400','Pemasaran & Iklan','beban',NULL,'');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_6-5100','6-5100','Beban Penyusutan','beban',NULL,'');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_6-9100','6-9100','Beban Lain-lain','beban','beban_lain','');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_7-1100','7-1100','Pendapatan Bunga & Lain-lain','pendapatan_lain',NULL,'');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_8-1100','8-1100','Biaya Administrasi Bank','beban_lain',NULL,'');--> statement-breakpoint
INSERT INTO `fin_accounts` (`id`,`code`,`name`,`grp`,`system_key`,`note`) VALUES ('acc_8-1200','8-1200','Beban di Luar Usaha','beban_lain',NULL,'');
