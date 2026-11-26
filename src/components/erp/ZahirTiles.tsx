// Ubin menu gaya Zahir Accounting 6 (Metro), disegarkan: warna bergradasi lembut, ikon garis putih, naik sedikit saat disorot.
// Ubin tanpa href = fitur yang belum tersedia → gembok + label "Segera".
import Link from "next/link";
import { Icon } from "@/components/panel/Icon";
import type { Tile } from "@/lib/erp/zahirMenu";

export function ZahirTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="zt-grid">
      {tiles.map((t) => {
        const cls = `zt zt-${t.color}${t.w === 2 ? " zt-w2" : ""}${t.h === 2 ? " zt-h2" : ""}${t.href ? "" : " is-locked"}`;
        const body = (
          <>
            <span className="zt-icon" aria-hidden="true"><Icon name={t.href ? t.icon : "lock"} size={t.w === 2 || t.h === 2 ? 46 : 38} stroke={1.5} /></span>
            <span className="zt-label">{t.label}</span>
            {!t.href && <span className="zt-soon">{t.note ?? "Segera"}</span>}
          </>
        );
        return t.href ? (
          <Link key={t.label} href={t.href} className={cls}>{body}</Link>
        ) : (
          <span key={t.label} className={cls} aria-disabled="true" title="Belum tersedia di web">{body}</span>
        );
      })}
    </div>
  );
}
