import Link from "next/link";
import { logout } from "@/app/admin/actions/auth";
import type { CurrentUser } from "@/lib/auth";
import { canOpen, MODULES, type ModuleKey } from "@/lib/roles";
import { PanelNav, type NavItem } from "./PanelNav";

/** Kerangka panel (sidebar + konten) yang dipakai /admin, /keuangan, dan /operasional. */
export function PanelShell({ module, tag, items, user, children }: { module: ModuleKey; tag: string; items: NavItem[]; user: CurrentUser; children: React.ReactNode }) {
  // Modul yang sedang dibuka tetap tampil (mis. staf keuangan melihat dokumen operasional hanya-baca).
  const mods = MODULES.filter((m) => canOpen(user.roles, m.key) || m.key === module);
  return (
    <div className={`admin panel-${module}`}>
      <aside className="admin-side hexpat">
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
        <PanelNav items={items} label={`Menu ${tag.toLowerCase()}`} />
        <div className="who">
          <Link href="/" target="_blank" style={{ color: "var(--oranye-terang)" }}>Lihat situs ↗</Link>
          <span>
            Masuk sebagai <b style={{ color: "#fff" }}>{user.name}</b>
          </span>
          <form action={logout}>
            <button type="submit" style={{ width: "100%" }}>Keluar</button>
          </form>
        </div>
      </aside>
      <main className="admin-main" id="konten">{children}</main>
    </div>
  );
}
