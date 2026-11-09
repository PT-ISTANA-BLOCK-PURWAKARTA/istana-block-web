#!/usr/bin/env python3
"""Crawl penuh konten WordPress istanablockpurwakarta.com lewat REST API.

Hasil:
  wp-corpus/raw/<tipe>.json      -> JSON mentah (semua field yang diminta)
  wp-corpus/<tipe>/<slug>.md     -> teks bersih + frontmatter (untuk dipakai ulang)
  wp-corpus/ringkasan.json       -> indeks + statistik
"""
import json, os, re, sys, time, urllib.error, urllib.parse, urllib.request
from html.parser import HTMLParser

BASE = "https://istanablockpurwakarta.com"
OUT = os.path.dirname(os.path.abspath(__file__)) + "/wp-corpus"
UA = {"User-Agent": "crawl-wp/1.0 (migrasi konten; kontak: pemilik situs)"}
FIELDS = "id,slug,link,date,modified,status,title,content,excerpt,categories,tags,featured_media,yoast_head_json,meta"


def get(url, retry=3):
    for i in range(retry):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read(), dict(r.headers)
        except Exception as e:
            if i == retry - 1:
                raise
            time.sleep(2 * (i + 1))


class Teks(HTMLParser):
    """HTML -> teks terstruktur ringan (heading, paragraf, list, tabel)."""

    BLOK = {"h1": "# ", "h2": "## ", "h3": "### ", "h4": "#### ", "li": "- ", "blockquote": "> "}

    def __init__(self):
        super().__init__()
        self.buf, self.akhir, self.lewati = [], [], 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript"):
            self.lewati += 1
        elif tag in self.BLOK:
            self.buf.append("\n" + self.BLOK[tag])
        elif tag in ("p", "div", "tr", "br", "figure", "figcaption"):
            self.buf.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript"):
            self.lewati = max(0, self.lewati - 1)

    def handle_data(self, data):
        if not self.lewati:
            t = re.sub(r"\s+", " ", data)
            if t.strip():
                self.buf.append(t)

    def teks(self):
        s = "".join(self.buf)
        s = re.sub(r"[ \t]+", " ", s)
        s = re.sub(r"\n\s*\n+", "\n\n", s)
        return s.strip()


def bersih(html):
    p = Teks()
    p.feed(html or "")
    return p.teks()


def tipe_konten():
    raw, _ = get(f"{BASE}/wp-json/wp/v2/types")
    data = json.loads(raw)
    hasil = {}
    for kunci, v in data.items():
        hasil[v.get("rest_base") or kunci] = kunci
    return hasil


def ambil_semua(rest_base):
    item, hal = [], 1
    while True:
        url = f"{BASE}/wp-json/wp/v2/{rest_base}?per_page=100&page={hal}&_fields={FIELDS}"
        try:
            raw, head = get(url)
        except urllib.error.HTTPError as e:
            if e.code == 400:  # halaman melewati jumlah
                break
            raise
        bagian = json.loads(raw)
        if not bagian:
            break
        item.extend(bagian)
        # Jangan bergantung pada header X-WP-Total (kadang tak dikirim): lanjut selama
        # halaman ini penuh 100 item.
        if len(bagian) < 100:
            break
        hal += 1
        if hal > 25:
            break
    return item


def main():
    os.makedirs(f"{OUT}/raw", exist_ok=True)
    types = tipe_konten()
    print("tipe:", ", ".join(sorted(types)))
    ringkasan = {"sumber": BASE, "diambil": time.strftime("%Y-%m-%d %H:%M:%S"), "tipe": {}}
    for rest, asli in sorted(types.items()):
        if rest in ("media", "comments", "blocks", "navigation", "font-families", "global-styles", "settings", "users", "menus", "menu-items", "templates", "template-parts", "pattern-directory"):
            continue
        try:
            item = ambil_semua(rest)
        except Exception as e:
            print(f"  ! {rest}: gagal ({e})")
            continue
        os.makedirs(f"{OUT}/{rest}", exist_ok=True)
        json.dump(item, open(f"{OUT}/raw/{rest}.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        stat = []
        for it in item:
            judul = bersih((it.get("title") or {}).get("rendered", ""))
            isi = bersih((it.get("content") or {}).get("rendered", ""))
            y = it.get("yoast_head_json") or {}
            fm = {
                "slug": it.get("slug"),
                "judul": judul,
                "tautan": it.get("link"),
                "terbit": it.get("date"),
                "diubah": it.get("modified"),
                "judul_seo": y.get("title"),
                "deskripsi_seo": y.get("description"),
                "kata": len(isi.split()),
            }
            with open(f"{OUT}/{rest}/{it.get('slug')}.md", "w", encoding="utf-8") as f:
                f.write("---\n" + json.dumps(fm, ensure_ascii=False, indent=1) + "\n---\n\n")
                f.write(f"# {judul}\n\n{isi}\n")
            stat.append(fm)
        total_kata = sum(s["kata"] for s in stat)
        ringkasan["tipe"][rest] = {
            "jumlah": len(stat),
            "total_kata": total_kata,
            "median_kata": sorted(s["kata"] for s in stat)[len(stat) // 2] if stat else 0,
            "item": stat,
        }
        print(f"  {rest:12} {len(stat):3} item | {total_kata:6} kata | median {ringkasan['tipe'][rest]['median_kata']}")
    json.dump(ringkasan, open(f"{OUT}/ringkasan.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("total kata seluruh situs:", sum(v["total_kata"] for v in ringkasan["tipe"].values()))


if __name__ == "__main__":
    sys.exit(main())
