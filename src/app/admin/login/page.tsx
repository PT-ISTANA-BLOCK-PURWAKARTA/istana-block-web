import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { homeFor, safeNext } from "@/lib/roles";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Masuk", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; e?: string }> }) {
  const { next, e } = await searchParams;
  const me = await getCurrentAdmin();
  if (me) {
    const home = safeNext(next, me.roles) ?? homeFor(me.roles);
    if (home) redirect(home);
  }
  return (
    <main className="login-wrap hexpat-light">
      <div className="login-card">
        <div className="brand">
          <img src="/brand/logo-istana-block.webp" alt="Istana Block Purwakarta" width={160} height={48} />
        </div>
        <h1 style={{ fontSize: 26 }}>Masuk</h1>
        <p className="muted small" style={{ marginTop: -8 }}>Panel situs, keuangan, dan operasional Istana Block.</p>
        {(e === "akses" || (me && !homeFor(me.roles))) && (
          <p className="alert alert-error" role="alert">Akun ini belum diberi akses ke modul mana pun. Minta pemilik mengatur perannya.</p>
        )}
        <LoginForm next={next ?? ""} />
      </div>
    </main>
  );
}
