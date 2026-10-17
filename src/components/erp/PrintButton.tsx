"use client";

export function PrintButton({ label = "Cetak" }: { label?: string }) {
  return (
    <button type="button" className="btn btn-ghost btn-sm no-print" onClick={() => window.print()}>
      {label}
    </button>
  );
}
