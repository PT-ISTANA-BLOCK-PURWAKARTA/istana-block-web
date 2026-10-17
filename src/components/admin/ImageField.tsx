"use client";

import { useRef, useState } from "react";
import { shrinkImage } from "./shrinkImage";

/** Memilih gambar, mengecilkannya di browser (maks 1600 px, WebP) lalu mengirim lewat form. */
export function ImageField({ name, current, label = "Gambar" }: { name: string; current: string | null; label?: string }) {
  const [preview, setPreview] = useState<string | null>(current);
  const [info, setInfo] = useState<string>("");
  const [fileName, setFileName] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const out = await shrinkImage(file);
    if (out !== file) {
      const dt = new DataTransfer();
      dt.items.add(out);
      if (ref.current) ref.current.files = dt.files;
      setInfo(`Dikecilkan: ${(file.size / 1024).toFixed(0)} KB → ${(out.size / 1024).toFixed(0)} KB`);
    }
    setPreview(URL.createObjectURL(out));
  }

  return (
    <div className="field">
      <label htmlFor={`${name}-file`}>{label}</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
        {preview ? <img src={preview} alt="" className="image-preview" /> : <div className="image-preview hexpat-light" aria-hidden="true" />}
        <div className="stack" style={{ gap: 8 }}>
          <div className="ui-file">
            <input ref={ref} id={`${name}-file`} name={name} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" onChange={onChange} />
            <label htmlFor={`${name}-file`} className="ui-file-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M5 15v4h14v-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {fileName || preview ? "Ganti gambar…" : "Pilih gambar…"}
            </label>
            <span className="ui-file-name">{fileName || (preview ? "Gambar saat ini" : "Belum ada gambar")}</span>
          </div>
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
