import Link from "next/link";
import { logout } from "@/app/internal/actions/auth";
import type { CurrentUser } from "@/lib/auth";
import { can, canOpen, MODULES, ROLE_SHORT, type ModuleKey, type Perm } from "@/lib/roles";
import { Icon } from "./Icon";
import { PanelNav, type NavItem } from "./PanelNav";
import { TopNav } from "./TopNav";

export type ShellItem = NavItem & { perm?: Perm | Perm[] };

/** Kerangka panel (sidebar + konten) yang dipakai /situs, /akuntansi, dan /operasional. */
/** layout "top" = menu atas horizontal (gaya Zahir Online, dipakai Keuangan); bawaan = menu samping. */
export function PanelShell({ module, tag, items, user, children, layout = "side" }: { module: ModuleKey; tag: string; items: ShellItem[]; user: CurrentUser; children: React.ReactNode; layout?: "side" | "top" }) {
  const mods = MODULES.filter((m) => canOpen(user.roles, m.key) || m.key === module);
  // Menu yang tidak boleh dipakai akun ini tidak ditampilkan sama sekali.
  const visible = items
    .filter((i) => !i.perm || (Array.isArray(i.perm) ? i.perm : [i.perm]).some((p) => can(user.roles, p)))
    .map(({ perm: _p, ...i }) => i);
  if (layout === "top") {
    return (
      <div className={`admin admin-top panel-${module}`}>
        <TopNav
          items={visible}
          modules={mods.map((m) => ({ key: m.key, href: m.href, label: m.label }))}
          current={module}
          user={{ name: user.name, role: user.roles.map((r) => ROLE_SHORT[r]).join(", ") || "Tanpa peran" }}
          homeHref={MODULES.find((m) => m.key === module)?.href ?? "/internal"}
          logout={logout}
        />
        <main className="admin-main" id="konten">
          <div className="main-inner">{children}</div>
        </main>
      </div>
    );
  }
  return (
    <div className={`admin panel-${module}`}>
      <aside className="admin-side hexpat">
        <div className="side-top">
          <Link href={MODULES.find((m) => m.key === module)?.href ?? "/internal"} className="brand">
            <img src="/brand/lambang-istana-block-putih.webp" alt="" width={129} height={150} />
            <span>Istana Block</span>
          </Link>
          {mods.length > 1 ? (
            <nav aria-label="Pilih modul" className="module-switch">
              {mods.map((m) => (
                <Link key={m.key} href={m.href} aria-current={m.key === module ? "page" : undefined}>
                  {m.label}
                </Link>
              ))}
            </nav>
          ) : (
            <span className="admin-tag">{tag}</span>
          )}
        </div>
        <PanelNav
          items={visible}
          label={`Menu ${tag.toLowerCase()}`}
          footer={
            <div className="who">
              <div className="who-name">
                <b>{user.name}</b>
                <span>{user.roles.map((r) => ROLE_SHORT[r]).join(", ") || "Tanpa peran"}</span>
              </div>
              <div className="who-actions">
                <Link href="/internal" className="who-link">
                  <Icon name="home" size={16} /> Semua aplikasi
                </Link>
                {module === "web" && (
                  <Link href="/" target="_blank" className="who-link">
                    <Icon name="external" size={16} /> Lihat situs
                  </Link>
                )}
                <form action={logout}>
                  <button type="submit" className="who-link">
                    <Icon name="logout" size={16} /> Keluar
                  </button>
                </form>
              </div>
            </div>
          }
        />
      </aside>
      <main className="admin-main" id="konten">
        <div className="main-inner">{children}</div>
      </main>
    </div>
  );
}
