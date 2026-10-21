"use client";

import { useEffect, useRef, useState } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { setSignature } from "@/app/operasional/actions/qc";
import "./qc.css";

/**
 * Papan tanda tangan (jari/mouse). Hasilnya PNG transparan yang dicetak di formulir QC saat pemilik akun
 * meng-ACC atau menandatangani. Tanda tangan lama bisa diganti atau dihapus.
 */
export function SignaturePad({ currentKey }: { currentKey: string | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [data, setData] = useState("");

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.clientWidth * ratio;
    c.height = c.clientHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0b2a6f";
  }, []);

  const at = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = e.currentTarget.getContext("2d")!;
    const p = at(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext("2d")!;
    const p = at(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    // PNG diambil setelah goresan selesai; dikirim lewat isian tersembunyi.
    setData(canvas.current!.toDataURL("image/png"));
  };
  const clear = () => {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setData("");
  };

  return (
    <section className="form-section" id="tanda-tangan">
      <h2>Tanda tangan saya</h2>
      <p className="small muted">Tanda tangan ini otomatis dicetak di formulir QC setiap kali Anda ACC atau menandatangani.</p>
      {currentKey && (
        <div className="qc-sig-now">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/operasional/berkas/${currentKey}`} alt="Tanda tangan saat ini" />
          <span className="small muted">Tanda tangan saat ini. Gambar ulang di bawah untuk mengganti.</span>
        </div>
      )}
      <ActionForm action={setSignature} className="stack" style={{ gap: 12 }}>
        <input type="hidden" name="data" value={data} />
        <canvas ref={canvas} className="qc-sig-pad" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Kotak tanda tangan" />
        <div className="form-actions" style={{ justifyContent: "flex-start" }}>
          <SubmitButton pendingText="Menyimpan…">Simpan tanda tangan</SubmitButton>
          <button type="button" className="btn btn-ghost" onClick={clear}>Ulangi</button>
        </div>
      </ActionForm>
      {currentKey && (
        <ActionForm action={setSignature}>
          <input type="hidden" name="hapus" value="1" />
          <SubmitButton className="link-btn" pendingText="Menghapus…">Hapus tanda tangan</SubmitButton>
        </ActionForm>
      )}
    </section>
  );
}
