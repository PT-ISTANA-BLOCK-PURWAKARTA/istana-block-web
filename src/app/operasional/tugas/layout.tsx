import type { Metadata } from "next";
import Link from "next/link";
import { logout } from "@/app/internal/actions/auth";
import { Icon } from "@/components/panel/Icon";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/roles";

export const metadata: Metadata = { title: { default: "Tugas antar", template: "%s · Tugas antar" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Tampilan ponsel untuk sopir: tanpa sidebar, tombol besar. */
export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const me = await requirePerm("antar");
  return (
    <div className="admin driver">
      <header className="driver-bar hexpat">
        <Link href="/operasional/tugas" className="driver-brand">
          <img src="/brand/logo-istana-block-putih.webp" alt="Istana Block" width={112} height={34} />
        </Link>
        <nav className="driver-nav" aria-label="Menu sopir">
          {can(me.roles, "lihat_ops") && <Link href="/operasional"><Icon name="home" size={18} /> Operasional</Link>}
          <Link href="/operasional/tugas/akun"><Icon name="user" size={18} /> <span>{me.name.split(" ")[0]}</span></Link>
          <form action={logout}><button type="submit"><Icon name="logout" size={18} /> Keluar</button></form>
        </nav>
      </header>
      <main className="driver-main" id="konten">{children}</main>
    </div>
  );
}
