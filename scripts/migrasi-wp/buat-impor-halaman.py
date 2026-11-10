#!/usr/bin/env python3
"""Buat SQL impor HALAMAN WordPress -> tabel `pages` D1.

Terbit (published=1) hanya halaman yang punya isi bisnis nyata dan belum punya padanan
rute di situs baru. Sisanya tetap dimasukkan sebagai draf (published=0) supaya isinya
tersimpan di CMS, tanpa menambah URL tipis/duplikat di situs publik.
"""
import json
import os
import re
from datetime import datetime, timedelta, timezone

AKAR = os.path.dirname(os.path.abspath(__file__)) + "/wp-corpus"
# __file__ = <repo>/scripts/migrasi-wp/<nama>: naik tiga tingkat ke akar repo.
_REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REPO = _REPO.replace("\\", "/")
KELUAR = f"{REPO}/drizzle/data/2026-11-impor-halaman-wp"
WIB = timezone(timedelta(hours=7))

# Halaman yang diterbitkan: topiknya beda dari rute/produk yang ada, isi >=150 kata.
TERBIT = {
    "servis",
    "pasang-paving-istanablock",
    "solusi-paving-block-industri-tahan-beban-berat-perawatan-hemat",
}
# Slug yang sudah punya rute/baris sendiri di situs baru -> tidak diimpor sama sekali.
SUDAH_ADA = {
    "produk", "pola-paving", "paket-proyek", "area-pengiriman", "galeri", "kontak",
    "profil", "privacy-policy", "paving-block-bekasi-cikarang",
    "paving-block-karawang-cikampek", "paving-block-subang",
}
JUDUL_ABAIKAN = re.compile(r"\s*[-|–]\s*Istana Block(Purwakarta)?\s*$", re.I)


def kutip(s):
    return "'" + (s or "").replace("'", "''") + "'"


def bersih_judul(s):
    return re.sub(r"\s+", " ", JUDUL_ABAIKAN.sub("", (s or "").strip()))


def potong(s, maks):
    s = re.sub(r"\s+", " ", (s or "")).strip()
    if len(s) <= maks:
        return s
    return s[:maks].rsplit(" ", 1)[0].rstrip(" -|–,;:")


def main():
    idx = json.load(open(f"{AKAR}/md/indeks.json", encoding="utf-8"))
    os.makedirs(KELUAR, exist_ok=True)
    for f in os.listdir(KELUAR):
        if f.endswith(".sql"):
            os.remove(os.path.join(KELUAR, f))

    baris, rollback, laporan = [], [], []
    for p in idx["pages"]:
        slug = p["slug"]
        if slug in SUDAH_ADA:
            continue
        md = open(f"{AKAR}/md/pages/{slug}.md", encoding="utf-8").read().split("---", 2)[-1].strip()
        # Buang H1 (template halaman sudah menampilkan judul) dan sisa HTML mentah.
        md = re.sub(r"(?m)^#\s+.*$", "", md)
        md = re.sub(r"</?[a-zA-Z][^>]{0,200}>", "", md)
        md = re.sub(r"\n{3,}", "\n\n", md).strip()
        kata = len(md.split())
        judul = bersih_judul(p["judul"]) or slug.replace("-", " ").title()
        ringkas = potong((p["deskripsi_seo"] or p.get("ringkas") or "").rstrip("[…] ").strip() or judul, 165)
        terbit = 1 if slug in TERBIT and kata >= 150 else 0
        seo_judul = potong(bersih_judul(p["judul_seo"]) or judul, 65)
        baris.append(
            "INSERT INTO pages (slug, title, kind, excerpt, content, cover_key, published, seo_title, seo_description, created_at, updated_at) "
            f"VALUES ({kutip(slug)}, {kutip(judul)}, 'info', {kutip(ringkas)}, {kutip(md)}, NULL, {terbit}, "
            f"{kutip(seo_judul)}, {kutip(ringkas)}, unixepoch(), unixepoch()) "
            "ON CONFLICT(slug) DO UPDATE SET title=excluded.title, excerpt=excluded.excerpt, content=excluded.content, "
            "published=excluded.published, seo_title=excluded.seo_title, seo_description=excluded.seo_description, "
            "updated_at=unixepoch();"
        )
        rollback.append(f"DELETE FROM pages WHERE slug = {kutip(slug)};")
        laporan.append((slug, kata, terbit))

    with open(f"{KELUAR}/01-halaman.sql", "w", encoding="utf-8", newline="\n") as f:
        f.write("-- Impor halaman WordPress (draf bila bukan isi bisnis).\n")
        f.write("\n".join(baris) + "\n")
    with open(f"{KELUAR}/rollback.sql", "w", encoding="utf-8", newline="\n") as f:
        f.write("-- Hapus halaman hasil impor.\n" + "\n".join(rollback) + "\n")

    print(f"halaman diimpor: {len(baris)} | terbit: {sum(1 for _, _, t in laporan if t)} | draf: {sum(1 for _, _, t in laporan if not t)}")
    for slug, kata, terbit in sorted(laporan, key=lambda x: -x[1]):
        print(f"  {'TERBIT' if terbit else 'draf  '} {kata:5} kata  {slug}")


if __name__ == "__main__":
    main()
