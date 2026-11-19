"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  NOMINATIM_JEDA_MS,
  linkGoogleMaps,
  parseHasilNominatim,
  tafsirMasukan,
  urlNominatim,
  type HasilCari,
  type HasilTitik,
  type TitikLokasi,
} from "@/lib/paving/lokasi";
import { IconAlert, IconInfo, IconMap } from "./Icons";
import css from "./PavingDesigner.module.css";

interface Props {
  /** Dipanggil saat lokasi dipilih (koordinat, tautan, hasil cari, atau lokasi saya). */
  onPilih: (titik: TitikLokasi, label: string) => void;
  /** Tombol "Lewati" atau "Tutup": peta ditampilkan apa adanya. */
  onLewati: () => void;
  petaSudahTampil: boolean;
}

/** Waktu permintaan Nominatim terakhir (module-level): kebijakan pakai maksimal 1 permintaan per detik. */
let nominatimTerakhir = 0;

const tunggu = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function pesanGeolokasi(err: GeolocationPositionError | { code: number }): string {
  if (err.code === 1)
    return "Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini di pengaturan browser, atau cari lewat alamat, koordinat, atau tautan Google Maps.";
  if (err.code === 2)
    return "Posisi perangkat belum bisa ditentukan. Pastikan GPS atau layanan lokasi menyala, lalu coba lagi.";
  if (err.code === 3) return "Pencarian posisi terlalu lama. Coba lagi di tempat terbuka, atau cari lewat alamat.";
  return "Lokasi saya tidak dapat dipakai. Coba cari lewat alamat, koordinat, atau tautan Google Maps.";
}

export function LokasiSearch({ onPilih, onLewati, petaSudahTampil }: Props) {
  const [masukan, setMasukan] = useState("");
  const [sibuk, setSibuk] = useState<"cari" | "gps" | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [hasil, setHasil] = useState<HasilCari[] | null>(null);
  const aktifRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    aktifRef.current = true;
    return () => {
      aktifRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const terapkan = (h: HasilTitik, label: string) => {
    if (!h.ok) {
      setPesan(h.pesan);
      return;
    }
    setPesan(null);
    setHasil(null);
    onPilih({ lat: h.lat, lng: h.lng }, label);
  };

  const cariNama = async (kueri: string) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const jeda = NOMINATIM_JEDA_MS - (Date.now() - nominatimTerakhir);
    if (jeda > 0) await tunggu(jeda);
    if (ac.signal.aborted) return;
    nominatimTerakhir = Date.now();
    try {
      const res = await fetch(urlNominatim(kueri), { signal: ac.signal });
      if (!res.ok) {
        setPesan(
          res.status === 429
            ? "Layanan pencarian sedang sibuk. Tunggu sebentar lalu tekan Cari lagi."
            : "Pencarian tempat sedang bermasalah. Coba lagi, atau tempel koordinat / tautan Google Maps.",
        );
        return;
      }
      const daftar = parseHasilNominatim(await res.json());
      if (!daftar.length) {
        setHasil(null);
        setPesan("Tempat tidak ditemukan. Coba tambahkan nama kecamatan atau kota, atau tempel koordinat / tautan Google Maps.");
        return;
      }
      setPesan(null);
      setHasil(daftar);
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setPesan("Tidak bisa terhubung ke layanan pencarian. Periksa koneksi internet Anda, atau tempel koordinat.");
    }
  };

  const cari = async (e?: FormEvent) => {
    e?.preventDefault();
    if (sibuk) return;
    const t = tafsirMasukan(masukan);
    setHasil(null);
    setPesan(null);
    if (t.jenis === "kosong") {
      setPesan("Ketik alamat atau nama tempat, atau tempel koordinat / tautan Google Maps.");
      return;
    }
    if (t.jenis === "koordinat") {
      terapkan(t.hasil, `${t.hasil.ok ? `${t.hasil.lat}, ${t.hasil.lng}` : ""}`);
      return;
    }
    if (t.jenis === "link-panjang") {
      terapkan(t.hasil, "Dari tautan Google Maps");
      return;
    }
    setSibuk("cari");
    try {
      if (t.jenis === "link-pendek") {
        const ac = new AbortController();
        abortRef.current = ac;
        const timer = setTimeout(() => ac.abort(), 8000);
        try {
          const res = await fetch("/api/lokasi/expand", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: t.url }),
            signal: ac.signal,
          });
          const data = (await res.json().catch(() => ({}))) as { lat?: number; lng?: number; error?: string };
          if (!aktifRef.current) return;
          if (res.ok && typeof data.lat === "number" && typeof data.lng === "number") {
            terapkan({ ok: true, lat: data.lat, lng: data.lng }, "Dari tautan Google Maps");
          } else {
            setPesan(data.error ?? "Tautan pendek tidak dapat dibuka. Coba tempel tautan panjangnya atau koordinat.");
          }
        } catch {
          if (aktifRef.current) setPesan("Tautan pendek tidak dapat dibuka. Coba tempel tautan panjangnya atau koordinat.");
        } finally {
          clearTimeout(timer);
        }
      } else {
        await cariNama(t.kueri);
      }
    } finally {
      if (aktifRef.current) setSibuk(null);
    }
  };

  const lokasiSaya = () => {
    if (sibuk) return;
    setHasil(null);
    setPesan(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPesan(pesanGeolokasi({ code: 0 }));
      return;
    }
    setSibuk("gps");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!aktifRef.current) return;
        setSibuk(null);
        terapkan(
          { ok: true, lat: Math.round(pos.coords.latitude * 1e6) / 1e6, lng: Math.round(pos.coords.longitude * 1e6) / 1e6 },
          "Lokasi saya",
        );
      },
      (err) => {
        if (!aktifRef.current) return;
        setSibuk(null);
        setPesan(pesanGeolokasi(err));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  return (
    <form className={css.lokasiBox} onSubmit={cari} aria-label="Cari lokasi proyek">
      <label className={css.label} htmlFor="cari-lokasi-proyek">
        Cari lokasi proyek
      </label>
      <p className={css.lokasiBantuan}>
        Ketik alamat atau nama tempat, tempel koordinat (contoh <strong>-6.5569, 107.4433</strong>) atau tautan Google
        Maps. Peta akan langsung terbuka di lokasi lahan Anda. Langkah ini boleh dilewati.
      </p>
      <div className={css.lokasiBaris}>
        <input
          id="cari-lokasi-proyek"
          className={css.input}
          type="text"
          inputMode="text"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Mis. Bungursari Purwakarta"
          value={masukan}
          onChange={(e) => setMasukan(e.target.value)}
        />
        <button type="submit" className="btn btn-blue btn-sm" disabled={sibuk !== null}>
          <IconMap size={15} />
          <span>{sibuk === "cari" ? "Mencari…" : "Cari"}</span>
        </button>
      </div>
      <div className={css.lokasiAksi}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={lokasiSaya} disabled={sibuk !== null}>
          <span>{sibuk === "gps" ? "Mencari posisi…" : "Lokasi saya"}</span>
        </button>
        <button type="button" className={css.lokasiLewati} onClick={onLewati}>
          {petaSudahTampil ? "Tutup pencarian" : "Lewati, geser peta sendiri"}
        </button>
      </div>

      {pesan && (
        <div className={css.errorAlert} role="alert">
          <IconAlert size={18} />
          <div>{pesan}</div>
        </div>
      )}

      {hasil && (
        <ul className={css.lokasiDaftar} aria-label="Hasil pencarian">
          {hasil.map((h, i) => (
            <li key={`${h.lat},${h.lng},${i}`}>
              <button
                type="button"
                className={css.lokasiItem}
                onClick={() => {
                  setHasil(null);
                  onPilih({ lat: h.lat, lng: h.lng }, h.nama);
                }}
                title={linkGoogleMaps(h.lat, h.lng)}
              >
                {h.nama}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className={css.lokasiAtribusi}>
        <IconInfo size={13} />
        <span>
          Pencarian nama tempat: ©{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
            OpenStreetMap
          </a>
          . Hanya teks yang Anda ketik yang dikirim.
        </span>
      </p>
    </form>
  );
}
