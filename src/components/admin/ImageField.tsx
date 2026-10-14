"use client";

import { useRef, useState } from "react";

/** Memilih gambar, mengecilkannya di browser (maks 1600 px, WebP) lalu mengirim lewat form. */
export function ImageField({ name, current, label = "Gambar" }: { name: string; current: string | null; label?: string }) {
  const [preview, setPreview] = useState<string | null>(current);
  const [info, setInfo] = useState<string>("");
  const ref = useRef<HTMLInputElement>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.type === "image/gif") {
      setPreview(URL.createObjectURL(file));
      return;
    }
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.82));
      if (blob && blob.size < file.size) {
        const out = new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
        const dt = new DataTransfer();
        dt.items.add(out);
        if (ref.current) ref.current.files = dt.files;
        setInfo(`Dikecilkan: ${(file.size / 1024).toFixed(0)} KB → ${(out.size / 1024).toFixed(0)} KB`);
      }
      setPreview(URL.createObjectURL(blob ?? file));
    } catch {
      setPreview(URL.createObjectURL(file));
    }
  }

  return (
    <div className="field">
      <label htmlFor={`${name}-file`}>{label}</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
        {preview ? <img src={preview} alt="" className="image-preview" /> : <div className="image-preview hexpat-light" aria-hidden="true" />}
        <div className="stack" style={{ gap: 8 }}>
          <input ref={ref} id={`${name}-file`} name={name} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" onChange={onChange} />
          <span className="help">JPG/PNG/WebP, maks 5 MB. Otomatis dikecilkan sebelum diunggah.</span>
          {info && <span className="help">{info}</span>}
          {current && (
            <label className="check" style={{ fontWeight: 500, minHeight: 0 }}>
              <input type="checkbox" name={`${name}_remove`} value="1" /> Hapus gambar saat ini
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
