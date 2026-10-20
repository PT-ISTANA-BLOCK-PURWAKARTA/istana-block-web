const TONES = { good: "badge-on", warn: "badge-warn", bad: "badge-danger", neutral: "badge-off" } as const;

const TONE_OF: Record<string, keyof typeof TONES> = {
  LULUS: "good", "TIDAK LULUS": "bad", Sesuai: "good", "Tidak Sesuai": "bad", "Perlu Perbaikan": "warn", Tercapai: "good", "Tidak Tercapai": "warn",
  TERCAPAI: "good", "BELUM TERCAPAI": "bad", "BELUM DIISI": "neutral",
  Open: "warn", Closed: "good", TERLAMBAT: "bad", SEGERA: "warn", Terjadwal: "good", "Tepat waktu": "good", "Selesai terlambat": "warn", Berjalan: "neutral", Selesai: "good",
  "Baik - Disetujui (AVL)": "good", "Cukup - Perlu Pembinaan": "warn", "Kurang - Evaluasi Ulang": "bad", Diterima: "good", "Diterima Bersyarat": "warn", "Ditolak/Retur": "bad",
  Normal: "good", Asam: "bad", Basa: "bad", "Di bawah standar": "bad", "Di atas standar": "bad", Baik: "good", Tidak: "bad", "Rusak/Berhenti": "bad",
};

/** Teks status berwarna (lencana) untuk nilai status yang dikenal; teks lain tampil biasa. */
export function Chip({ text }: { text: string }) {
  const tone = TONE_OF[text];
  return tone ? <span className={`badge ${TONES[tone]}`}>{text}</span> : <>{text}</>;
}
