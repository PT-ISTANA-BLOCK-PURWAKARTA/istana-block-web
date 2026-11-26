// Pemilih periode BULAN (bukan tanggal) untuk laporan bersekat per bulan dan perbandingan 2 kolom.
import Link from "next/link";
import { BLN } from "@/lib/erp/monthly";

const ymAdd = (ym: string, n: number) => { const d = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1)); return d.toISOString().slice(0, 7); };

export function MonthBar({ path, mode, dari, sampai, a, b, now, single }: { path: string; mode: "bulanan" | "banding"; dari: string; sampai: string; a: string; b: string; now: string; single?: boolean }) {
  const q = (p: Record<string, string>) => `${path}?${new URLSearchParams(p)}`;
  const presets = [
    { label: "Bulan ini", dari: now, sampai: now },
    { label: "3 bulan", dari: ymAdd(now, -2), sampai: now },
    { label: "6 bulan", dari: ymAdd(now, -5), sampai: now },
    { label: "12 bulan", dari: ymAdd(now, -11), sampai: now },
    { label: `Tahun ${now.slice(0, 4)}`, dari: `${now.slice(0, 4)}-01`, sampai: now },
  ];
  return (
    <div className="mb">
      <nav className="zt-tabs" aria-label="Jenis tampilan">
        <Link href={q({ mode: "bulanan", dari, sampai })} aria-current={mode === "bulanan" ? "page" : undefined}>Per bulan</Link>
        <Link href={q({ mode: "banding", a, b })} aria-current={mode === "banding" ? "page" : undefined}>Perbandingan 2 kolom</Link>
      </nav>
      <form method="get" className="filter-bar">
        <input type="hidden" name="mode" value={mode} />
        {mode === "bulanan" ? (
          <>
            {!single && <div className="field"><label htmlFor="mb-dari">Dari bulan</label><input id="mb-dari" type="month" name="dari" defaultValue={dari} /></div>}
            <div className="field"><label htmlFor="mb-sampai">{single ? "Per akhir bulan" : "Sampai bulan"}</label><input id="mb-sampai" type="month" name="sampai" defaultValue={sampai} /></div>
          </>
        ) : (
          <>
            <div className="field"><label htmlFor="mb-a">Bulan</label><input id="mb-a" type="month" name="a" defaultValue={a} /></div>
            <div className="field"><label htmlFor="mb-b">Dibanding bulan</label><input id="mb-b" type="month" name="b" defaultValue={b} /></div>
          </>
        )}
        <button type="submit" className="btn btn-blue btn-sm">Tampilkan</button>
        {mode === "bulanan"
          ? presets.map((p) => <Link key={p.label} href={q({ mode, dari: p.dari, sampai: p.sampai })} className={`btn btn-ghost btn-sm${p.dari === dari && p.sampai === sampai ? " is-on" : ""}`}>{p.label}</Link>)
          : [
              { label: "Bulan ini vs bulan lalu", a: now, b: ymAdd(now, -1) },
              { label: "Bulan lalu vs 2 bulan lalu", a: ymAdd(now, -1), b: ymAdd(now, -2) },
              { label: `Bulan ini vs ${BLN[Number(now.slice(5, 7)) - 1]} tahun lalu`, a: now, b: ymAdd(now, -12) },
            ].map((p) => <Link key={p.label} href={q({ mode, a: p.a, b: p.b })} className={`btn btn-ghost btn-sm${p.a === a && p.b === b ? " is-on" : ""}`}>{p.label}</Link>)}
      </form>
    </div>
  );
}
