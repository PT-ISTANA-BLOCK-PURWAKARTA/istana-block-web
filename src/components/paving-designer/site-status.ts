/**
 * Status masukan bentuk lahan terhadap hasil hitung yang sedang tampil:
 * - "ok": geometri terbaru sudah dikirim (hasil hitung boleh dipakai bila sudah segar)
 * - "editing": pengguna sedang mengubah ukuran (menunggu jeda ketik / selesai seret)
 * - "invalid": bentuk belum valid/belum selesai; hasil di layar milik bentuk sebelumnya
 */
export type SiteInputStatus = "ok" | "editing" | "invalid";
