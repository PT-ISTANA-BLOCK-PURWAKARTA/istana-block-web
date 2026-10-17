import Link from "next/link";
import { logout } from "@/app/admin/actions/auth";
import type { CurrentUser } from "@/lib/auth";
import { can, canOpen, MODULES, ROLE_SHORT, type ModuleKey, type Perm } from "@/lib/roles";
import { Icon } from "./Icon";
import { PanelNav, type NavItem } from "./PanelNav";

export type ShellItem = NavItem & { perm?: Perm | Perm[] };

/** Kerangka panel (sidebar + konten) yang dipakai /admin, /keuangan, dan /operasional. */
export function PanelShell({ module, tag, items, user, children }: { module: ModuleKey; tag: string; items: ShellItem[]; user: CurrentUser; children: React.ReactNode }) {
  const mods = MODULES.filter((m) => canOpen(user.roles, m.key) || m.key === module);
  // Menu yang tidak boleh dipakai akun ini tidak ditampilkan sama sekali.
  const visible = items
    .filter((i) => !i.perm || (Array.isArray(i.perm) ? i.perm : [i.perm]).some((p) => can(user.roles, p)))
    .map(({ perm: _p, ...i }) => i);
  return (
    <div className={`admin panel-${module}`}>
      <aside className="admin-side hexpat">
        <div className="side-top">
          <Link href={MODULES.find((m) => m.key === module)?.href ?? "/admin"} className="brand">
            <img src="/brand/logo-istana-block-putih.webp" alt="Istana Block Purwakarta" width={147} height={44} />
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
                <Link href="/" target="_blank" className="who-link">
                  <Icon name="external" size={16} /> Lihat situs
                </Link>
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
