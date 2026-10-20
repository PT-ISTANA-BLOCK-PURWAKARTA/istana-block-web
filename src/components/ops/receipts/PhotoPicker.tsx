"use client";

import { useEffect, useRef, useState } from "react";

const MAX_SIDE = 1600;

type Picked = { file: File; url: string };

/** Kecilkan foto kamera HP (≤ 1600 px, JPEG) supaya unggahan cepat di sinyal lapangan dan lolos batas 5 MB. */
async function shrink(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (blob && (blob.size < file.size || file.type !== "image/jpeg")) {
      return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
    }
  } catch {
    // Browser lama tanpa createImageBitmap: kirim apa adanya (server tetap membatasi 5 MB).
  }
  return file;
}

/**
 * Pengambil foto kamera (maks `max` foto). Foto dikompres di HP, lalu dimasukkan ke input file tersembunyi
 * bernama `name`, sehingga ikut terkirim bersama form (ActionForm) tanpa kode tambahan.
 */
export function PhotoPicker({ name, max = 1, label = "Ambil foto", hint }: { name: string; max?: number; label?: string; hint?: string }) {
  const hidden = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sinkronkan input file tersembunyi dengan daftar foto.
  useEffect(() => {
    if (!hidden.current) return;
    const transfer = new DataTransfer();
    for (const photo of photos) transfer.items.add(photo.file);
    hidden.current.files = transfer.files;
  }, [photos]);

  // Bebaskan URL pratinjau saat komponen dilepas.
  const latest = useRef(photos);
  latest.current = photos;
  useEffect(() => () => latest.current.forEach((photo) => URL.revokeObjectURL(photo.url)), []);

  async function pick(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Pilih berkas gambar.");
    setError(null);
    setBusy(true);
    try {
      const small = await shrink(file);
      setPhotos((current) => [...current, { file: small, url: URL.createObjectURL(small) }].slice(0, max));
    } catch {
      setError("Foto tidak dapat dibaca.");
    } finally {
      setBusy(false);
    }
  }

  function remove(index: number) {
    setPhotos((current) => {
      URL.revokeObjectURL(current[index].url);
      return current.filter((_, i) => i !== index);
    });
  }

  return (
    <div className="rcv-photos-wrap">
      {/* Input bernama (tersembunyi) yang dikirim bersama form; input kamera di bawah sengaja tanpa nama. */}
      <input ref={hidden} type="file" name={name} accept="image/*" capture="environment" multiple hidden aria-hidden="true" tabIndex={-1} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
      <div className="rcv-photos">
        {photos.map((photo, index) => (
          <div className="rcv-thumb" key={photo.url}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt={`Foto ${index + 1}`} />
            <button type="button" aria-label={`Hapus foto ${index + 1}`} onClick={() => remove(index)}>×</button>
          </div>
        ))}
        {photos.length < max && (
          <button type="button" className={`btn btn-ghost rcv-add${photos.length ? "" : " rcv-add-wide"}`} disabled={busy} onClick={() => camera.current?.click()}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.5-2.5h7L17 8h3v11H4zM12 16.5a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
            {busy ? "Mengecilkan foto…" : photos.length ? "Tambah foto" : label}
          </button>
        )}
      </div>
      {hint && !photos.length && <span className="help small muted">{hint}</span>}
      {error && <span className="small text-bahaya" role="alert">{error}</span>}
    </div>
  );
}
