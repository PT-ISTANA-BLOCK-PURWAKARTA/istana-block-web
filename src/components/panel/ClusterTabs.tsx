"use client";

// Tab di atas halaman untuk kelompok menu yang disatukan di sidebar (mis. Produksi & target, Stok, Armada & sopir).
// Hanya tampil bila halaman yang dibuka termasuk salah satu kelompok; tab yang tidak boleh dibuka akun ini sudah disaring server.
import Link from "next/link";
import { usePathname } from "next/navigation";

export type Cluster = { tabs: { href: string; label: string }[] };

const matches = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

export function ClusterTabs({ clusters }: { clusters: Cluster[] }) {
  const path = usePathname();
  const cluster = clusters.find((c) => c.tabs.length > 1 && c.tabs.some((t) => matches(path, t.href)));
  if (!cluster) return null;
  const active = cluster.tabs.map((t) => t.href).filter((h) => matches(path, h)).sort((a, b) => b.length - a.length)[0];
  return (
    <nav className="seg no-print" aria-label="Bagian" style={{ marginBottom: 16, overflowX: "auto", maxWidth: "100%" }}>
      {cluster.tabs.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.href === active ? "page" : undefined}>{t.label}</Link>
      ))}
    </nav>
  );
}
