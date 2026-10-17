"use client";

import { useRef, useState } from "react";

const MAX_SIDE = 1600;

/**
 * Input foto bukti terima. Foto kamera HP (sering 4–10 MB) dikecilkan di HP dulu (≤ 1600 px, JPEG),
 * supaya unggahan cepat di sinyal lapangan dan tidak melewati batas 5 MB.
 */
export function ProofInput({ id, required, label = "Foto bukti terima", help = "surat jalan bertanda tangan / barang di lokasi" }: { id: string; required?: boolean; label?: string; help?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function shrink(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file || !file.type.startsWith("image/")) return setPreview(null);
    setBusy(true);
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
      if (blob && blob.size < file.size) {
        const dt = new DataTransfer();
        dt.items.add(new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }));
        input.files = dt.files;
      }
      setPreview(URL.createObjectURL(input.files?.[0] ?? file));
    } catch {
      // Browser lama tanpa createImageBitmap: kirim apa adanya (server tetap membatasi 5 MB).
      setPreview(URL.createObjectURL(file));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field">
      <label htmlFor={id}>
        {label} {help && <span className="help">{help}</span>}
      </label>
      <input ref={ref} id={id} name="proof" type="file" accept="image/*" capture="environment" required={required} onChange={shrink} />
      {busy && <span className="help">Mengecilkan foto…</span>}
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Pratinjau foto bukti" className="proof-preview" />
      )}
    </div>
  );
}
