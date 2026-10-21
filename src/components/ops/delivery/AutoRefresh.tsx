"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Muat ulang data halaman server tiap N detik (hanya saat tab terlihat). Pengganti polling di inventori-ops. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
