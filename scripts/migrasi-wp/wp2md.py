#!/usr/bin/env python3
"""WordPress HTML -> Markdown bersih berbasis BeautifulSoup4 (tanpa HTML mentah & tanpa tautan putus).

Masukan : wp-corpus/raw/posts.json, wp-corpus/raw/pages.json, wp-corpus/gambar-peta.json
Keluaran: wp-corpus/md/<tipe>/<slug>.md  (frontmatter JSON + markdown)
          wp-corpus/md/indeks.json       (statistik + daftar gambar & tautan)
"""
import html as htmlmod
import json
import os
import re
from bs4 import BeautifulSoup, NavigableString, Tag

AKAR = os.path.dirname(os.path.abspath(__file__)) + "/wp-corpus"
ABAI_TAG = {"script", "style", "noscript", "iframe", "form", "button", "svg", "nav", "footer", "header"}
ABAI_CLASS = ("elementor-widget-counter", "elementor-counter", "elementor-widget-spacer", "elementor-screen-only")

PETA_GAMBAR = {}
if os.path.exists(f"{AKAR}/gambar-peta.json"):
    PETA_GAMBAR = json.load(open(f"{AKAR}/gambar-peta.json", encoding="utf-8"))


def kandidat(src, srcset=""):
    """Daftar URL calon, terbaik lebih dulu (sama dengan wp-gambar.py)."""
    if not src:
        return []
    asli = re.sub(r"-\d+x\d+(\.(jpg|jpeg|png|webp|gif))$", r"\1", src, flags=re.I)
    besar = []
    for bagian in (srcset or "").split(","):
        bagian = bagian.strip().split(" ")[0]
        if bagian:
            m = re.search(r"-(\d+)x(\d+)\.(jpg|jpeg|png|webp|gif)", bagian, re.I)
            besar.append((int(m.group(1)) if m else 0, bagian))
    besar.sort(reverse=True)
    hasil = []
    for u in [asli] + [u for _, u in besar] + [src]:
        if u and u not in hasil:
            hasil.append(u)
    return hasil


POTONG_BOILER = [
    r"The post .*? appeared first on .*?\.",
    r"\s*\[/?(?:caption|gallery|embed|video|audio|playlist|contact-form-7|wpforms|vc_[a-z_]*|et_pb_[a-z_]*|su_[a-z_]*|table|row|column|button|toc)(?:\s[^\]]*)?\]",
]


def norm_inline(s):
    return re.sub(r"[ \t\r\n]+", " ", s)


def wrap_mark(text, marker):
    """Bungkus inline bold/italic tanpa meninggalkan spasi di dalam penanda & tanpa mematahkan blok."""
    if not text or not text.strip():
        return text
    # Jangan bungkus blok gambar atau multiline penuh dengan **...**
    if "\n" in text or "![" in text:
        parts = re.split(r"(\n+|!\[[^\]]*\]\([^)]+\))", text)
        out = []
        for p in parts:
            if not p or not p.strip() or p.startswith("\n") or p.startswith("!["):
                out.append(p)
            else:
                out.append(wrap_mark(p, marker))
        return "".join(out)
    lead = text[: len(text) - len(text.lstrip(" \t\r\n"))]
    trail = text[len(text.rstrip(" \t\r\n")) :]
    core = text.strip(" \t\r\n")
    if not core:
        return text
    # Hindari penanda ganda jika sudah terbungkus
    if core.startswith(marker) and core.endswith(marker) and len(core) > len(marker) * 2:
        return text
    return f"{lead}{marker}{core}{marker}{trail}"


class Converter:
    def __init__(self, judul=""):
        self.judul = judul
        self.no_gambar = 0
        self.gambar = []
        self.tautan = []
        self.in_heading = False

    def render_children(self, el):
        chunks = []
        for ch in el.children:
            s = self.render(ch)
            if s:
                # Pisahkan dua tautan yang menempel langsung (mis. tombol CTA Elementor bersebelahan)
                if chunks and chunks[-1].rstrip().endswith(")") and s.lstrip().startswith("[") and re.search(r"\]\([^)]+\)\s*$", chunks[-1]):
                    chunks.append(" · ")
                chunks.append(s)
        return "".join(chunks)

    def render_img(self, el):
        src = (el.get("data-lazy-src") or el.get("data-src") or el.get("src") or "").strip()
        if not src or src.startswith("data:"):
            return ""
        alt = norm_inline(el.get("alt") or "").strip()
        srcset = el.get("srcset") or ""
        self.gambar.append({"src": src, "alt": alt})
        info = None
        for url in kandidat(src, srcset):
            info = PETA_GAMBAR.get(url)
            if info and info.get("key"):
                break
        if info and info.get("key"):
            self.no_gambar += 1
            teks = alt or f"{self.judul} (gambar {self.no_gambar})"
            teks = teks.replace("[", "(").replace("]", ")")
            return f"\n\n![{teks}](/media/{info['key']})\n\n"
        return ""

    def render_table(self, el):
        rows = []
        for tr in el.find_all("tr"):
            cells = []
            for cell in tr.find_all(["th", "td"], recursive=False):
                # render isi sel sebagai inline bersih
                txt = norm_inline(self.render_children(cell)).strip().replace("|", "\\|")
                cells.append(txt)
            if any(cells):
                rows.append(cells)
        if not rows:
            return ""
        max_cols = max(len(r) for r in rows)
        out = []
        for i, r in enumerate(rows):
            padded = r + [""] * (max_cols - len(r))
            out.append("| " + " | ".join(padded) + " |")
            if i == 0:
                out.append("| " + " | ".join(["---"] * max_cols) + " |")
        return "\n\n" + "\n".join(out) + "\n\n"

    def render_list(self, el, ordered=False, depth=0):
        lines = []
        idx = 0
        indent = "  " * depth
        for li in el.find_all("li", recursive=False):
            idx += 1
            sub_lists = []
            # Render isi li tanpa nested ul/ol dulu
            parts = []
            for ch in li.children:
                if isinstance(ch, Tag) and ch.name in ("ul", "ol"):
                    sub_lists.append(self.render_list(ch, ch.name == "ol", depth + 1))
                else:
                    parts.append(self.render(ch))
            text = norm_inline("".join(parts)).strip()
            if text:
                prefix = f"{idx}." if ordered else "-"
                lines.append(f"{indent}{prefix} {text}")
            for sl in sub_lists:
                if sl.strip():
                    lines.append(sl.strip("\n"))
        if not lines:
            return ""
        return ("\n\n" if depth == 0 else "\n") + "\n".join(lines) + ("\n\n" if depth == 0 else "\n")

    def render(self, node):
        if isinstance(node, NavigableString):
            # Abaikan komentar HTML
            if type(node).__name__ == "Comment":
                return ""
            return re.sub(r"[ \t\r\n]+", " ", str(node))
        if not isinstance(node, Tag):
            return ""
        name = (node.name or "").lower()
        if name in ABAI_TAG:
            return ""
        classes = node.get("class") or []
        if isinstance(classes, str):
            classes = classes.split()
        if any(c in ABAI_CLASS for c in classes):
            return ""

        if name in ("h1", "h2", "h3", "h4", "h5", "h6"):
            prev = self.in_heading
            self.in_heading = True
            txt = norm_inline(self.render_children(node)).strip()
            self.in_heading = prev
            if not txt:
                return ""
            level = int(name[1])
            return f"\n\n{'#' * level} {txt}\n\n"

        if name == "p":
            inner = self.render_children(node).strip()
            if not inner:
                return ""
            # Rapikan spasi di baris dalam paragraf, pertahankan line break eksplisit (  \n)
            return f"\n\n{inner}\n\n"

        if name == "br":
            return " " if self.in_heading else "  \n"

        if name in ("strong", "b"):
            inner = self.render_children(node)
            if self.in_heading:
                return inner
            return wrap_mark(inner, "**")

        if name in ("em", "i"):
            inner = self.render_children(node)
            if self.in_heading:
                return inner
            return wrap_mark(inner, "*")

        if name == "a":
            href = (node.get("href") or "").strip()
            inner = self.render_children(node)
            if "![" in inner:
                return inner
            clean = norm_inline(inner).strip()
            if not clean:
                return ""
            if not href or href.startswith("#") or href.lower().startswith("javascript:"):
                return inner
            self.tautan.append(href)
            # Pertahankan spasi luar jika ada di inner
            lead = inner[: len(inner) - len(inner.lstrip(" \t"))]
            trail = inner[len(inner.rstrip(" \t")) :]
            return f"{lead}[{clean}]({href}){trail}"

        if name == "img":
            return self.render_img(node)

        if name == "figure":
            img_md = ""
            cap_txt = ""
            for img in node.find_all("img"):
                img_md += self.render_img(img)
            cap = node.find("figcaption")
            if cap:
                cap_txt = norm_inline(self.render_children(cap)).strip()
            if img_md:
                if cap_txt:
                    return f"\n\n{img_md.strip()}\n*{cap_txt}*\n\n"
                return img_md
            return self.render_children(node)

        if name == "figcaption":
            return ""

        if name == "blockquote":
            inner = self.render_children(node).strip()
            if not inner:
                return ""
            lines = [f"> {ln.strip()}" if ln.strip() else ">" for ln in inner.splitlines()]
            return "\n\n" + "\n".join(lines) + "\n\n"

        if name in ("ul", "ol"):
            return self.render_list(node, ordered=(name == "ol"))

        if name == "table":
            return self.render_table(node)

        if name == "hr":
            return "\n\n---\n\n"

        if name in ("div", "section", "article", "main", "aside"):
            inner = self.render_children(node).strip()
            return f"\n\n{inner}\n\n" if inner else ""

        return self.render_children(node)


def ke_markdown(html, judul=""):
    soup = BeautifulSoup(html or "", "html.parser")
    conv = Converter(judul)
    s = conv.render_children(soup)
    for pola in POTONG_BOILER:
        s = re.sub(pola, " ", s, flags=re.S | re.I)
    s = htmlmod.unescape(s)
    s = s.replace("\u00a0", " ").replace("\u200b", "")
    # Rapikan spasi per baris (tanpa merusak trailing double-space line break)
    lines = []
    for ln in s.splitlines():
        had_br = ln.endswith("  ")
        cleaned = re.sub(r"[ \t]+", " ", ln).strip()
        if cleaned and had_br:
            cleaned += "  "
        lines.append(cleaned)
    s = "\n".join(lines)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip(), conv.gambar, conv.tautan


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
                "featured_media": it.get("featured_media") or 0,
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
        print(f"{tipe:6} {len(daftar):3} item | {total:7} kata markdown | {gmbr:4} gambar | {sum(len(x['daftar_tautan']) for x in daftar):4} tautan")
    json.dump(indeks, open(f"{AKAR}/md/indeks.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    semua_gambar = [g["src"] for t in indeks.values() for it in t for g in it["daftar_gambar"]]
    unik = sorted(set(semua_gambar))
    print("gambar unik dipakai di isi:", len(unik))
    json.dump(unik, open(f"{AKAR}/md/gambar-unik.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
