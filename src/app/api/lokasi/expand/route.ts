import { NextResponse } from "next/server";
import {
  MAKS_REDIRECT,
  adalahLinkPendek,
  koordinatDariHtmlGoogle,
  koordinatDariUrlGoogle,
  periksaUrlGoogle,
  tujuanRedirect,
} from "@/lib/paving/lokasi";

/**
 * Perluas tautan pendek Google Maps (maps.app.goo.gl, goo.gl/maps) menjadi koordinat.
 * Anti-SSRF: hanya host daftar putih (lib/paving/lokasi.ts), https saja, redirect diikuti MANUAL (maks 5)
 * dan host tiap hop diperiksa ulang, batas waktu total 5 detik. Respons hanya {lat,lng} atau {error};
 * isi halaman tidak pernah dikembalikan.
 */
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 5000;
const MAKS_BYTE_HTML = 256 * 1024;
const BATAS_PERMINTAAN = 12; // per IP per menit (best-effort, memori isolate)
const JENDELA_MS = 60_000;
const hitungan = new Map<string, { n: number; sejak: number }>();

function kenaBatas(ip: string): boolean {
  const now = Date.now();
  if (hitungan.size > 500) {
    for (const [k, v] of hitungan) if (now - v.sejak > JENDELA_MS) hitungan.delete(k);
  }
  const cur = hitungan.get(ip);
  if (!cur || now - cur.sejak > JENDELA_MS) {
    hitungan.set(ip, { n: 1, sejak: now });
    return false;
  }
  cur.n += 1;
  return cur.n > BATAS_PERMINTAAN;
}

function galat(pesan: string, status: number) {
  return NextResponse.json({ error: pesan }, { status, headers: { "Cache-Control": "no-store" } });
}

async function bacaTeksTerbatas(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const dec = new TextDecoder();
  let out = "";
  let total = 0;
  while (total < MAKS_BYTE_HTML) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    total += value.byteLength;
    out += dec.decode(value, { stream: true });
  }
  void reader.cancel().catch(() => {});
  return out;
}

export async function POST(req: Request) {
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  if (kenaBatas(ip)) return galat("Terlalu banyak permintaan. Coba lagi sebentar lagi.", 429);

  let url = "";
  try {
    const body = (await req.json()) as { url?: unknown };
    url = typeof body.url === "string" ? body.url.trim() : "";
  } catch {
    return galat("Permintaan tidak valid.", 400);
  }
  if (!url || url.length > 300 || !adalahLinkPendek(url)) return galat("Hanya tautan pendek Google Maps yang didukung.", 400);

  const awal = periksaUrlGoogle(/^https?:\/\//i.test(url) ? url : `https://${url}`);
  if (!awal.ok) return galat("Tautan tidak diizinkan.", 400);

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    let cur: URL = awal.url;
    for (let hop = 0; hop <= MAKS_REDIRECT; hop++) {
      const res = await fetch(cur.toString(), {
        method: "GET",
        redirect: "manual",
        signal: ac.signal,
        headers: { Accept: "text/html", "Accept-Language": "id" },
      });

      if (res.status >= 300 && res.status < 400) {
        void res.body?.cancel().catch(() => {});
        const next = tujuanRedirect(cur, res.headers.get("location"));
        if (!next) return galat("Tautan tidak dapat diikuti.", 422);
        const cek = periksaUrlGoogle(next);
        if (!cek.ok) return galat("Tautan mengarah ke luar Google Maps, tidak diikuti.", 422);
        const titik = koordinatDariUrlGoogle(cek.url.toString());
        if (titik) return NextResponse.json(titik, { headers: { "Cache-Control": "no-store" } });
        cur = cek.url;
        continue;
      }

      if (res.ok) {
        const titik = koordinatDariHtmlGoogle(await bacaTeksTerbatas(res));
        if (titik) return NextResponse.json(titik, { headers: { "Cache-Control": "no-store" } });
      } else {
        void res.body?.cancel().catch(() => {});
      }
      return galat("Koordinat tidak ditemukan pada tautan ini. Coba tautan panjang dari tombol Bagikan.", 422);
    }
    return galat("Tautan terlalu banyak dialihkan.", 422);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return galat("Google Maps tidak menjawab tepat waktu. Coba lagi.", 504);
    return galat("Tautan tidak dapat dibuka. Coba tautan panjang.", 502);
  } finally {
    clearTimeout(timer);
  }
}
