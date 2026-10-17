import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/panel/Icon";
import { requireOwner } from "@/lib/auth";
import { logout } from "../actions/auth";

export const metadata: Metadata = { title: { default: "Pengguna & peran", template: "%s · Istana Block" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Halaman tingkat portal (bukan milik satu aplikasi): bilah atas sederhana + konten. */
export default async function PortalPageLayout({ children }: { children: React.ReactNode }) {
  const me = await requireOwner();
  return (
    <div className="admin portal-page">
      <header className="portal-bar hexpat">
        <Link href="/internal" className="portal-bar-back"><Icon name="back" size={18} /> Semua aplikasi</Link>
        <img src="/brand/logo-istana-block-putih.webp" alt="Istana Block Purwakarta" width={120} height={36} className="portal-bar-logo" />
        <div className="portal-bar-who">
          <span>{me.name}</span>
          <form action={logout}><button type="submit" className="portal-out"><Icon name="logout" size={16} /> Keluar</button></form>
        </div>
      </header>
      <main className="portal-page-main" id="konten">{children}</main>
    </div>
  );
}
