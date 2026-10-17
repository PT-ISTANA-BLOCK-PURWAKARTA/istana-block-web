import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { canOpen, moduleHome, moduleOf, safeNext, type ModuleKey } from "@/lib/roles";
import { Icon, type IconName } from "@/components/panel/Icon";
import { EmailLoginForm, OpsLogin } from "./LoginForms";

export const APP_META: Record<ModuleKey, { icon: IconName; title: string; lead: string; how: string }> = {
  web: { icon: "web", title: "Situs", lead: "Produk, harga, artikel, dan halaman istanablockpurwakarta.com.", how: "Masuk dengan email" },
  operasional: { icon: "truck", title: "Operasional", lead: "Pesanan, pengiriman, stok gudang, dan posisi truk.", how: "Nomor HP & PIN, atau email" },
  keuangan: { icon: "ledger", title: "Keuangan", lead: "Faktur, kas & bank, pembelian, dan laporan keuangan.", how: "Masuk dengan email" },
};

/** Halaman masuk satu aplikasi. Sudah login & berhak → langsung ke aplikasinya. */
export async function LoginScreen({ module, searchParams }: { module: ModuleKey; searchParams: Promise<{ next?: string; e?: string; cara?: string }> }) {
  const { next, e, cara } = await searchParams;
  const meta = APP_META[module];
  const mod = moduleOf(module);
  const me = await getCurrentAdmin();
  if (me && canOpen(me.roles, module) && e !== "email") redirect(safeNext(next, me.roles) ?? moduleHome(me.roles, module));

  const needEmail = e === "email" || (me?.via === "pin" && module !== "operasional");
  return (
    <main className="login-wrap hexpat-light">
      <div className="login-card">
        <Link href="/internal" className="login-back">
          <Icon name="back" size={16} /> Pilih aplikasi lain
        </Link>
        <div className="login-app">
          <span className={`app-mark app-${module}`} aria-hidden="true"><Icon name={meta.icon} size={26} /></span>
          <div>
            <span className="login-kicker">Istana Block</span>
            <h1>{meta.title}</h1>
          </div>
        </div>
        <p className="muted small">{meta.lead}</p>
        {needEmail && (
          <p className="alert alert-warn" role="alert">
            {mod.label} hanya bisa dibuka dengan akun email. Anda tadi masuk dengan nomor HP &amp; PIN; masuk lagi dengan email dan password.
          </p>
        )}
        {!needEmail && me && !canOpen(me.roles, module) && (
          <p className="alert alert-error" role="alert">
            Anda masuk sebagai {me.name}, yang tidak punya akses ke {mod.label}. Masuk dengan akun lain, atau kembali dan pilih aplikasi Anda.
          </p>
        )}
        {e === "akses" && !me && <p className="alert alert-error" role="alert">Akun itu tidak punya akses ke aplikasi ini.</p>}
        {module === "operasional" ? (
          <OpsLogin next={next ?? ""} initial={cara === "email" || needEmail ? "email" : "pin"} />
        ) : (
          <EmailLoginForm module={module} next={next ?? ""} />
        )}
      </div>
    </main>
  );
}
