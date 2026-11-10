#!/usr/bin/env python3
"""WordPress HTML -> Markdown bersih (untuk react-markdown: tanpa HTML mentah).

Masukan : wp-corpus/raw/posts.json, wp-corpus/raw/pages.json
Keluaran: wp-corpus/md/<tipe>/<slug>.md  (frontmatter YAML + markdown)
          wp-corpus/md/indeks.json       (statistik + daftar gambar)
"""
import html as htmlmod
import json
import os
import re
from html.parser import HTMLParser

AKAR = os.path.dirname(os.path.abspath(__file__)) + "/wp-corpus"
BLOK_ABAIKAN = {"script", "style", "noscript", "iframe", "form", "button", "svg", "nav", "footer", "header"}

# Peta URL gambar WordPress -> key R2 (dibuat wp-gambar.py). Bila ada, gambar ikut ditulis
# sebagai ![](/media/<key>) sehingga isi artikel tidak kehilangan gambarnya.
PETA_GAMBAR = {}
if os.path.exists(f"{AKAR}/gambar-peta.json"):
    PETA_GAMBAR = json.load(open(f"{AKAR}/gambar-peta.json", encoding="utf-8"))


def kandidat(src, srcset):
    """Daftar URL calon, terbaik lebih dulu (sama dengan wp-gambar.py)."""
    asli = re.sub(r"-\d+x\d+(\.(jpg|jpeg|png|webp))$", r"", src, flags=re.I)
    besar = []
    for bagian in (srcset or "").split(","):
        bagian = bagian.strip().split(" ")[0]
        if bagian:
            m = re.search(r"-(\d+)x(\d+)\.(jpg|jpeg|png|webp)", bagian, re.I)
            besar.append((int(m.group(1)) if m else 0, bagian))
    besar.sort(reverse=True)
    hasil = []
    for u in [asli] + [u for _, u in besar] + [src]:
        if u and u not in hasil:
            hasil.append(u)
    return hasil


POTONG_BOILER = [
    r"The post .*? appeared first on .*?\.",
    r"\s*\[/?vc_[^\]]*\]",
    r"\s*\[/?et_pb[^\]]*\]",
    r"\s*\[/?caption[^\]]*\]",
    r"\s*\[/?gallery[^\]]*\]",
    # Hanya shortcode yang dikenal. Pola lama "\[[a-z_]+[^\]]*\]" juga memakan
    # teks alternatif gambar ("![Judul (gambar 1)](...)"), sehingga gambarnya hilang.
    r"\s*\[/?(?:caption|gallery|embed|video|audio|playlist|contact-form-7|wpforms|vc_[a-z_]*|et_pb_[a-z_]*|su_[a-z_]*|table|row|column|button|toc)(?:\s[^\]]*)?\]",
]


class MD(HTMLParser):
    def __init__(self, judul=""):
        super().__init__(convert_charrefs=True)
        self.judul = judul
        self.no_gambar = 0
        self.out = []
        self.abai = 0
        self.daftar = []          # tumpukan jenis daftar: 'ul'/'ol'
        self.dalam_tabel = 0
        self.baris = []
        self.sel = []
        self.prefiks = ""
        self.gambar = []
        self.tautan = []

    # ---------- util ----------
    def tulis(self, s):
        self.out.append(s)

    def baris_baru(self):
        if self.out and not self.out[-1].endswith("\n\n"):
            self.out.append("\n")

    # ---------- tag ----------
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in BLOK_ABAIKAN:
            self.abai += 1
            return
        if self.abai:
            return
        if self.dalam_tabel and tag not in ("table", "tr", "td", "th"):
            # Semua penanda inline di dalam sel ditulis ke buffer sel, bukan ke dokumen.
            masuk = {"strong": "**", "b": "**", "em": "*", "i": "*", "br": " "}.get(tag)
            if masuk:
                self.sel.append(masuk)
            return
        if tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self.baris_baru()
            self.tulis("\n" + "#" * int(tag[1]) + " ")
        elif tag == "p":
            self.baris_baru()
            self.tulis("\n")
        elif tag == "br":
            self.tulis("  \n")
        elif tag in ("strong", "b"):
            self.tulis("**")
        elif tag in ("em", "i"):
            self.tulis("*")
        elif tag == "blockquote":
            self.baris_baru()
            self.tulis("\n> ")
        elif tag in ("ul", "ol"):
            self.baris_baru()
            self.daftar.append(tag)
        elif tag == "li":
            self.baris_baru()
            if self.daftar and self.daftar[-1] == "ol":
                self.tulis("\n1. ")
            else:
                self.tulis("\n- ")
        elif tag == "a":
            href = (a.get("href") or "").strip()
            if href and not href.startswith("#"):
                self.tautan.append(href)
                self.tulis("[")
        elif tag == "img":
            src = (a.get("src") or a.get("data-src") or "").strip()
            alt = re.sub(r"\s+", " ", (a.get("alt") or "")).strip()
            if src:
                self.gambar.append({"src": src, "alt": alt})
                info = None
                for url in kandidat(src, a.get("srcset") or ""):
                    info = PETA_GAMBAR.get(url)
                    if info and info.get("key"):
                        break
                if info and info.get("key"):
                    self.no_gambar += 1
                    # Alt kosong dari WordPress: pakai judul artikel + urutan supaya gambar
                    # tetap punya teks alternatif untuk mesin pencari gambar dan pembaca layar.
                    teks = alt or f"{self.judul} (gambar {self.no_gambar})"
                    self.baris_baru()
                    self.tulis(f"\n![{teks}](/media/{info['key']})\n")
        elif tag == "table":
            self.dalam_tabel += 1
            self.baris_baru()
            self._baris_tabel = 0
        elif tag == "tr" and self.dalam_tabel:
            self.baris = []
        elif tag in ("td", "th") and self.dalam_tabel:
            self.sel = []
        elif tag == "hr":
            self.tulis("\n\n---\n\n")

    def handle_endtag(self, tag):
        if tag in BLOK_ABAIKAN:
            self.abai = max(0, self.abai - 1)
            return
        if self.abai:
            return
        if self.dalam_tabel and tag not in ("table", "tr", "td", "th"):
            if tag in ("strong", "b"):
                self.sel.append("**")
            return
        if tag in ("h1", "h2", "h3", "h4", "h5", "h6", "p"):
            self.tulis("\n\n")
        elif tag in ("strong", "b"):
            self.tulis("**")
        elif tag in ("em", "i"):
            self.tulis("*")
        elif tag in ("ul", "ol"):
            if self.daftar:
                self.daftar.pop()
            self.tulis("\n\n")
        elif tag == "li":
            self.tulis("\n")
        elif tag == "a":
            self.tulis("]")
        elif tag == "table":
            self.dalam_tabel = max(0, self.dalam_tabel - 1)
            self.tulis("\n\n")
        elif tag in ("td", "th") and self.dalam_tabel:
            self.baris.append(re.sub(r"\s+", " ", "".join(self.sel)).strip())
            self.sel = []
        elif tag == "tr" and self.dalam_tabel:
            if any(self.baris):
                self.tulis("| " + " | ".join(self.baris) + " |\n")
                if getattr(self, "_baris_tabel", 0) == 0:
                    self.tulis("|" + "|".join([" --- "] * len(self.baris)) + "|\n")
                self._baris_tabel = getattr(self, "_baris_tabel", 0) + 1

    def handle_data(self, data):
        if self.abai or self.dalam_tabel and False:
            return
        if self.dalam_tabel and not self.sel:
            # teks di dalam sel ditangkap lewat _teks_sel
            pass
        t = re.sub(r"\s+", " ", data)
        if not t.strip():
            if self.out and not self.out[-1].endswith((" ", "\n")):
                self.tulis(" ")
            return
        if self.dalam_tabel:
            self.sel.append(t)
        else:
            self.tulis(t)


def ke_markdown(html, judul=""):
    p = MD(judul)
    p.feed(html or "")
    s = "".join(p.out)
    for pola in POTONG_BOILER:
        s = re.sub(pola, " ", s, flags=re.S | re.I)
    s = htmlmod.unescape(s)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r" *\n *", "\n", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    s = re.sub(r"\(\s*\)", "", s)
    return s.strip(), p.gambar, p.tautan


def main():
    os.makedirs(f"{AKAR}/md", exist_ok=True)
    indeks = {}
    for tipe in ("posts", "pages"):
        data = json.load(open(f"{AKAR}/raw/{tipe}.json", encoding="utf-8"))
        os.makedirs(f"{AKAR}/md/{tipe}", exist_ok=True)
        daftar = []
        for it in data:
            judul = htmlmod.unescape(re.sub(r"<[^>]+>", "", (it.get("title") or {}).get("rendered", ""))).strip()
            isi_html = (it.get("content") or {}).get("rendered", "")
            md, gambar, tautan = ke_markdown(isi_html, judul)
            y = it.get("yoast_head_json") or {}
            ringkas = htmlmod.unescape(re.sub(r"<[^>]+>", "", (it.get("excerpt") or {}).get("rendered", ""))).strip()
            fm = {
                "slug": it.get("slug"),
                "judul": judul,
                "tautan": it.get("link"),
                "terbit": it.get("date"),
                "diubah": it.get("modified"),
                "judul_seo": y.get("title"),
                "deskripsi_seo": y.get("description"),
                "ringkas": ringkas,
                "kata": len(md.split()),
                "gambar": len(gambar),
            }
            with open(f"{AKAR}/md/{tipe}/{it.get('slug')}.md", "w", encoding="utf-8") as f:
                f.write("---\n" + json.dumps(fm, ensure_ascii=False, indent=1) + "\n---\n\n" + md + "\n")
            fm["daftar_gambar"] = gambar
            fm["daftar_tautan"] = tautan
            daftar.append(fm)
        indeks[tipe] = daftar
        total = sum(x["kata"] for x in daftar)
        gmbr = sum(x["gambar"] for x in daftar)
        print(f"{tipe:6} {len(daftar):3} item | {total:7} kata markdown | {gmbr:4} gambar")
    json.dump(indeks, open(f"{AKAR}/md/indeks.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    semua_gambar = [g["src"] for t in indeks.values() for it in t for g in it["daftar_gambar"]]
    unik = sorted(set(semua_gambar))
    print("gambar unik dipakai di isi:", len(unik))
    json.dump(unik, open(f"{AKAR}/md/gambar-unik.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
