"use client";

import { useRef, useState, useTransition } from "react";
import { createTrackingLink } from "@/app/operasional/actions/deliveries";

/**
 * Buat tautan lacak publik untuk pelanggan (/kiriman/<token>), salin, atau bagikan lewat WhatsApp.
 * Token hanya muncul sekali (di server hanya SHA-256-nya), jadi setiap klik membuat tautan baru.
 * `summary` = teks ringkas tanpa harga (surat jalan, tujuan, muatan).
 */
export function TrackingShare({ deliveryId, summary, count, lastOpened }: { deliveryId: string; summary: string; count: number; lastOpened: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function create() {
    setErr(null);
    setCopied(false);
    start(async () => {
      const r = await createTrackingLink(deliveryId);
      if (r.error || !r.path) setErr(r.error ?? "Gagal membuat tautan.");
      else setUrl(`${window.location.origin}${r.path}`);
    });
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      input.current?.select();
      setCopied(document.execCommand("copy"));
    }
  }

  const wa = url ? `https://wa.me/?text=${encodeURIComponent(`${summary}\nPantau pengiriman: ${url}`)}` : null;
  return (
    <div className="dl-track">
      <p className="small muted">
        {count > 0 || url ? `${count + (url ? 1 : 0)} tautan sudah dibuat${lastOpened ? ` · terakhir dibuka ${lastOpened}` : " · belum pernah dibuka"}.` : "Belum ada tautan."} Pelanggan membuka tautan tanpa login dan hanya melihat progres, muatan, sopir, dan posisi truk (tanpa harga).
      </p>
      {!url && (
        <div>
          <button type="button" className="btn btn-blue btn-sm" onClick={create} disabled={pending}>{pending ? "Membuat…" : "Buat tautan lacak"}</button>
        </div>
      )}
      {url && (
        <>
          <div className="dl-link">
            <input ref={input} readOnly value={url} aria-label="Tautan lacak" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>{copied ? "Tersalin" : "Salin"}</button>
            {wa && <a className="btn btn-primary btn-sm" href={wa} target="_blank" rel="noopener noreferrer">Bagikan WhatsApp</a>}
          </div>
          <p className="small muted">Simpan atau kirim sekarang; tautan ini tidak bisa ditampilkan lagi setelah halaman ditutup.</p>
        </>
      )}
      {err && <p className="small text-bahaya" role="alert">{err}</p>}
    </div>
  );
}
