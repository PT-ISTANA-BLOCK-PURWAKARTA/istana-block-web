import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/auth";
import { logout } from "../actions/auth";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin Istana Block" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="admin">
      <aside className="admin-side hexpat">
        <Link href="/admin" className="brand">
          <img src="/brand/logo-istana-block-putih.webp" alt="Istana Block Purwakarta" width={147} height={44} />
        </Link>
        <span className="admin-tag">Panel admin</span>
        <AdminNav />
        <div className="who">
          <Link href="/" target="_blank" style={{ color: "var(--oranye-terang)" }}>Lihat situs ↗</Link>
          <span>Masuk sebagai <b style={{ color: "#fff" }}>{admin.name}</b></span>
          <form action={logout}>
            <button type="submit" style={{ width: "100%" }}>Keluar</button>
          </form>
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
