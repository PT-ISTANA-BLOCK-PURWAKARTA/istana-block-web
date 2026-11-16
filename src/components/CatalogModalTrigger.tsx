"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import "./katalog.css";

const LazyCatalogCarousel = dynamic(
  () => import("./CatalogCarousel").then((m) => m.CatalogCarousel),
  { ssr: false },
);

export type CatalogModalTriggerProps = {
  whatsapp: string;
  label?: string;
  className?: string;
  variant?: "button" | "link";
  initialPage?: number;
};

/**
 * Pemicu pratinjau Katalog 11 halaman langsung dalam `<dialog>` native
 * agar pengunjung halaman produk, beranda, atau sampel bisa membaca katalog
 * tanpa berpindah ke Google Drive atau meninggalkan halaman aktif.
 */
export function CatalogModalTrigger({
  whatsapp,
  label = "Lihat Katalog (PDF)",
  className,
  variant = "button",
  initialPage = 1,
}: CatalogModalTriggerProps) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  const triggerClass =
    variant === "link"
      ? `ib-cat-link-trigger${className ? ` ${className}` : ""}`
      : className || "btn btn-ghost";

  return (
    <>
      <button
        type="button"
        className={triggerClass}
        onClick={() => setOpen(true)}
        data-cta="katalog-modal"
      >
        {variant === "button" && (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        )}
        <span>{label}</span>
      </button>

      <dialog
        ref={dialogRef}
        className="ib-cat-dialog"
        aria-label="Katalog Produk & Layanan Istana Block Purwakarta"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setOpen(false);
        }}
      >
        {open && (
          <div className="ib-cat-modal-shell">
            <div className="ib-cat-modal-head">
              <div className="ib-cat-modal-title-group">
                <p className="ib-cat-modal-title">Katalog Produk Istana Block</p>
                <span className="ib-cat-modal-sub">11 halaman · SNI &amp; TKDN</span>
              </div>
              <div className="ib-cat-modal-head-actions">
                <Link
                  prefetch={false}
                  href={initialPage > 1 ? `/katalog?halaman=${initialPage}` : "/katalog"}
                  className="ib-cat-modal-ext"
                  onClick={() => setOpen(false)}
                >
                  <span>Buka halaman /katalog</span>
                  <span aria-hidden="true">↗</span>
                </Link>
                <button
                  type="button"
                  className="ib-cat-modal-close"
                  aria-label="Tutup pratinjau katalog"
                  onClick={() => setOpen(false)}
                >
                  ×
                </button>
              </div>
            </div>

            <LazyCatalogCarousel
              compact
              whatsapp={whatsapp}
              initialPage={initialPage}
            />
          </div>
        )}
      </dialog>
    </>
  );
}

export { CatalogModalTrigger as CatalogPreviewButton };
