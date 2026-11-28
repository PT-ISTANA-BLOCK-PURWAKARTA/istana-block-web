"use client";

// Tombol "← Kembali" untuk halaman gaya Zahir (daftar Kas, Buku Besar): kembali ke halaman sebelumnya di aplikasi ini,
// seperti tombol back browser. Tidak ada halaman sebelumnya di aplikasi (dibuka langsung di tab baru, atau sebelumnya
// halaman login) → ke `fallback`, supaya tidak jatuh ke tab kosong atau keluar dari aplikasi.
import { useRouter } from "next/navigation";

// Navigation API (Chrome/Edge/Safari baru) hanya berisi riwayat dari situs ini sendiri.
type NavLike = { currentEntry: { index: number } | null; entries(): { url: string | null }[] };

export function BackButton({ fallback, className = "btn btn-ghost btn-sm zd-back" }: { fallback: string; className?: string }) {
  const router = useRouter();
  const kembali = () => {
    const nav = (window as unknown as { navigation?: NavLike }).navigation;
    const prev = nav?.currentEntry ? nav.entries()[nav.currentEntry.index - 1] : undefined;
    const ada = nav ? !!prev?.url && !new URL(prev.url).pathname.endsWith("/masuk") : window.history.length > 1;
    if (ada) router.back();
    else router.push(fallback);
  };
  return (
    <button type="button" className={className} onClick={kembali} title="Kembali ke halaman sebelumnya" aria-label="Kembali ke halaman sebelumnya">
      ← <span className="zd-back-txt">Kembali</span>
    </button>
  );
}
