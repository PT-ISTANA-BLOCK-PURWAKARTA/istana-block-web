#!/usr/bin/env python3
"""Buat SQL impor artikel WordPress -> tabel `articles` D1 (istana-block-web).

Sumber : wp-corpus/md/indeks.json + wp-corpus/md/posts/*.md (hasil crawl-wp.py + wp2md.py)
Keluaran: <repo>/drizzle/data/2026-11-impor-artikel-wp/*.sql  (maks 50 artikel/file)
          <repo>/drizzle/data/2026-11-impor-artikel-wp/rollback.sql
"""
import json
import os
import re
import unicodedata
from datetime import datetime, timedelta, timezone

AKAR = os.path.dirname(os.path.abspath(__file__)) + "/wp-corpus"
_REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = _REPO.replace("\\", "/")
KELUAR = f"{REPO}/drizzle/data/2026-11-impor-artikel-wp"
WIB = timezone(timedelta(hours=7))

# Halaman yang sudah ada di situs baru (dipakai untuk memvalidasi tautan internal).
HALAMAN_BARU = {
    "/", "/produk", "/paket-proyek", "/galeri", "/artikel", "/kontak", "/area-pengiriman",
    "/pola-paving", "/kredit-foto", "/privacy-policy", "/profil", "/sertifikat-tkdn",
    "/paving-block-bekasi-cikarang", "/paving-block-karawang-cikampek", "/paving-block-subang",
    "/produk/paving-block", "/produk/u-ditch", "/produk/buis-beton", "/produk/kanstin",
    "/produk/genteng-beton", "/produk/greffel-beton", "/produk/jasa-pasang-paving",
}
PETA_SAMPUL = [
    (r"kanstin", "/img/produk/kanstin.webp"),
    (r"u-?ditch|saluran", "/img/produk/u-ditch.webp"),
    (r"buis|gorong", "/img/produk/buis-beton.webp"),
    (r"genteng|atap|nok|lisplang", "/img/produk/genteng-beton.webp"),
    (r"greffel|grill", "/img/produk/greffel-beton.webp"),
    (r"jasa|pasang|instalasi", "/img/produk/jasa-pasang-paving.webp"),
    (r"paving|conblock|block", "/img/produk/paving-block.webp"),
]
JUDUL_ABAIKAN = re.compile(r"\s*[-|–]\s*Istana Block(Purwakarta)?\s*$", re.I)


def bersihkan_judul(s):
    s = (s or "").strip()
    s = JUDUL_ABAIKAN.sub("", s)
    return re.sub(r"\s+", " ", s)


def potong(s, maks, tambahan=""):
    """Potong di batas kata, tanpa menggantung tanda baca."""
    s = re.sub(r"\s+", " ", (s or "")).strip().strip(" -|–,;:")
    if len(s) <= maks:
        return s
    ruang = maks - (len(tambahan) if tambahan else 0)
    bagian = s[:ruang].rsplit(" ", 1)[0].rstrip(" -|–,;:")
    return bagian + tambahan if tambahan else bagian


def waktu(iso):
    try:
        return int(datetime.fromisoformat(iso).replace(tzinfo=WIB).timestamp())
    except Exception:
        return int(datetime.now(WIB).timestamp())


def rapikan_markdown(md, sasaran):
    """Tautan internal jadi relatif & hanya ke halaman yang benar-benar ada; HTML mentah dibuang."""
    def ganti(m):
        teks, url = m.group(1), m.group(2)
        if url.startswith("http") and "istanablockpurwakarta.com" not in url:
            return m.group(0)
        jalur = re.sub(r"^https?://(www\.)?istanablockpurwakarta\.com", "", url)
        jalur = "/" + jalur.strip("/") if jalur.strip("/") else "/"
        jalur = jalur.split("?")[0].split("#")[0]
        if jalur.rstrip("/") in sasaran or jalur == "/":
            return f"[{teks}]({jalur.rstrip('/') or '/'})"
        return teks  # sasaran tidak ada di situs baru: lepaskan tautannya, teks tetap

    md = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+|/[^)\s]*)\)", ganti, md)
    # Sisa HTML mentah tidak dirender react-markdown: buang tag-nya, sisakan teks.
    md = re.sub(r"</?[a-zA-Z][^>]{0,200}>", "", md)
    md = re.sub(r"\[/?[a-z_]{2,}\][^\n]{0,80}", "", md, flags=re.I)  # shortcode sisa
    md = md.replace("\u00a0", " ").replace("\u200b", "")
    md = re.sub(r"[ \t]+\n", "\n", md)
    md = re.sub(r"\n{3,}", "\n\n", md)
    md = re.sub(r"[ \t]{2,}", " ", md)
    # Baris yang hanya berisi penanda kosong
    md = re.sub(r"\n(\*\*|##?|>|-)\s*\n", "\n", md)
    return md.strip()


def sampul(slug, judul):
    t = f"{slug} {judul}".lower()
    for pola, kunci in PETA_SAMPUL:
        if re.search(pola, t):
            return kunci
    return "/img/produk/paving-block.webp"


def kutip(s):
    return "'" + (s or "").replace("'", "''") + "'"


def main():
    idx = json.load(open(f"{AKAR}/md/indeks.json", encoding="utf-8"))
    posts = idx["posts"]

    # Buang duplikat 96,8% (slug berbeda, isi nyaris sama) -> simpan yang lebih panjang.
    panjang = {p["slug"]: p["kata"] for p in posts}
    drop = set()
    if "paving-block-murah" in panjang and "paving-block-murah-untuk-hunian" in panjang:
        drop.add("paving-block-murah" if panjang["paving-block-murah"] < panjang["paving-block-murah-untuk-hunian"] else "paving-block-murah-untuk-hunian")

    terpakai = [p for p in posts if p["slug"] not in drop]
    hanya = {s for s in os.environ.get("HANYA", "").split(",") if s}
    if hanya:
        terpakai = [p for p in terpakai if p["slug"] in hanya]
    keluar = os.environ.get("KELUAR", KELUAR)
    per_file = int(os.environ.get("PER_FILE", "50"))
    sasaran = set(HALAMAN_BARU) | {f"/artikel/{p['slug']}" for p in posts}

    baris, rollback, stat = [], [], []
    for p in terpakai:
        slug = p["slug"]
        path = f"{AKAR}/md/posts/{slug}.md"
        md = open(path, encoding="utf-8").read().split("---", 2)[-1].strip()
        md = rapikan_markdown(md, sasaran)
        if len(md.split()) < 200:
            stat.append((slug, "dilewati: <200 kata", 0))
            continue
        judul = bersihkan_judul(p["judul"]) or slug.replace("-", " ").title()
        kepala = bersihkan_judul(p["judul_seo"]) or judul
        seo_judul = potong(kepala, 65)
        if len(seo_judul) < 30:
            seo_judul = potong(f"{seo_judul} | Istana Block", 65)
        ringkas = (p["deskripsi_seo"] or p["ringkas"] or "").strip().rstrip("[…] ").strip()
        if len(ringkas) < 70:
            paragraf = [x for x in md.split("\n\n") if len(x.split()) > 12]
            ringkas = (paragraf[0] if paragraf else judul)
        ringkas = potong(ringkas, 165)
        kata = len(md.split())
        baris.append(
            "INSERT INTO articles (slug, title, excerpt, content, cover_key, published, published_at, seo_title, seo_description, created_at, updated_at) "
            f"VALUES ({kutip(slug)}, {kutip(judul)}, {kutip(ringkas)}, {kutip(md)}, {kutip(sampul(slug, judul))}, 1, {waktu(p['terbit'])}, "
            f"{kutip(seo_judul)}, {kutip(ringkas)}, unixepoch(), unixepoch()) "
            f"ON CONFLICT(slug) DO UPDATE SET title=excluded.title, excerpt=excluded.excerpt, content=excluded.content, "
            f"cover_key=excluded.cover_key, published=1, published_at=excluded.published_at, seo_title=excluded.seo_title, "
            f"seo_description=excluded.seo_description, updated_at=unixepoch();"
        )
        rollback.append(f"DELETE FROM articles WHERE slug = {kutip(slug)};")
        stat.append((slug, "siap", kata))

    os.makedirs(keluar, exist_ok=True)
    for lama in os.listdir(keluar):
        if lama.endswith(".sql") and os.path.isfile(os.path.join(keluar, lama)):
            os.remove(os.path.join(keluar, lama))
    for i in range(0, len(baris), per_file):
        nomor = i // per_file + 1
        with open(f"{keluar}/{nomor:02d}-artikel.sql", "w", encoding="utf-8") as f:
            f.write("-- Impor artikel dari WordPress (crawl-wp.py + wp2md.py).\n")
            f.write("\n".join(baris[i:i + per_file]) + "\n")
    with open(f"{keluar}/rollback.sql", "w", encoding="utf-8") as f:
        f.write("-- Hapus artikel hasil impor bila perlu dibatalkan.\n" + "\n".join(rollback) + "\n")

    siap = [s for s in stat if s[1] == "siap"]
    print(f"artikel siap impor : {len(siap)}")
    print(f"  dilewati         : {len([s for s in stat if s[1] != 'siap'])}")
    print(f"  total kata       : {sum(s[2] for s in siap)}")
    if siap:
        print(f"  median kata      : {sorted(s[2] for s in siap)[len(siap) // 2]}")
    print(f"file SQL           : {len([f for f in os.listdir(KELUAR) if f.endswith('.sql')])} (di {KELUAR})")
    for s in [x for x in stat if x[1] != "siap"][:5]:
        print("  lewat:", s[0], "-", s[1])


if __name__ == "__main__":
    main()
