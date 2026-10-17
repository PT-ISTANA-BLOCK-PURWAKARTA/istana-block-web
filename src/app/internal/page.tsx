import type { Metadata } from "next";
import Link from "next/link";
import { APP_META } from "@/components/auth/LoginScreen";
import { Icon } from "@/components/panel/Icon";
import { getCurrentAdmin } from "@/lib/auth";
import { canOpen, MODULES, moduleHome, ROLE_SHORT } from "@/lib/roles";
import { logout } from "./actions/auth";

export const metadata: Metadata = { title: "Aplikasi internal", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Pintu masuk semua aplikasi internal: pilih Situs, Operasional, atau Keuangan. */
export default async function Internal({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  const me = await getCurrentAdmin();
  return (
    <main className="portal hexpat">
      <header className="portal-top">
        <Link href="/" className="portal-logo">
          <img src="/brand/logo-istana-block-putih.webp" alt="Istana Block Purwakarta" width={160} height={48} />
        </Link>
        {me && (
          <div className="portal-who">
            <span>
              <b>{me.name}</b>
              <small>{me.roles.map((r) => ROLE_SHORT[r]).join(", ") || "Tanpa peran"}</small>
            </span>
            <form action={logout}>
              <button type="submit" className="portal-out"><Icon name="logout" size={16} /> Keluar</button>
            </form>
          </div>
        )}
      </header>

      <section className="portal-body" aria-labelledby="portal-title">
        <h1 id="portal-title">{me ? `Halo, ${me.name.split(" ")[0]}. Buka aplikasi:` : "Masuk ke aplikasi kerja"}</h1>
        <p className="portal-lead">
          {!me
            ? "Pilih aplikasi sesuai pekerjaan Anda. Staf gudang, sopir, dan lapangan masuk ke Operasional dengan nomor HP & PIN."
            : MODULES.every((m) => canOpen(me.roles, m.key))
              ? "Semua aplikasi terbuka untuk akun Anda."
              : "Aplikasi yang bukan bagian Anda tetap tampil, tapi terkunci. Masuk dengan akun lain bila perlu."}
        </p>
        {e === "akses" && <p className="portal-alert" role="alert">Akun itu belum diberi akses ke aplikasi tersebut. Minta pemilik mengatur perannya.</p>}

        <div className="portal-grid">
          {MODULES.map((m) => {
            const meta = APP_META[m.key];
            const open = !!me && canOpen(me.roles, m.key);
            const locked = !!me && !open;
            const href = open ? moduleHome(me!.roles, m.key) : m.login;
            return (
              <Link key={m.key} href={href} className={`app-tile app-${m.key}${locked ? " is-locked" : ""}`} aria-describedby={`app-${m.key}-desc`}>
                <span className="app-mark" aria-hidden="true"><Icon name={meta.icon} size={30} /></span>
                <span className="app-name">{meta.title}</span>
                <span className="app-desc" id={`app-${m.key}-desc`}>{meta.lead}</span>
                <span className="app-foot">
                  {open ? (
                    <><Icon name="check" size={16} /> Buka</>
                  ) : locked ? (
                    <><Icon name="lock" size={16} /> Bukan akses Anda · masuk dengan akun lain</>
                  ) : (
                    <><Icon name={m.pin ? "phone" : "mail"} size={16} /> {meta.how}</>
                  )}
                  <span className="app-go" aria-hidden="true"><Icon name="chevron" size={18} /></span>
                </span>
              </Link>
            );
          })}
        </div>

        {me?.roles.includes("owner") && (
          <Link href="/internal/pengguna" className="portal-admin">
            <Icon name="users" size={18} /> Pengguna &amp; peran
            <small>Buat akun staf, atur peran, nomor HP &amp; PIN</small>
          </Link>
        )}
      </section>

      <footer className="portal-foot">
        <Link href="/">Kembali ke istanablockpurwakarta.com</Link>
      </footer>
    </main>
  );
}
