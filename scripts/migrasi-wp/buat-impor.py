#!/usr/bin/env python3
"""Buat SQL impor artikel WordPress -> tabel `articles` D1 (istana-block-web).

Sumber : wp-corpus/md/indeks.json + wp-corpus/md/posts/*.md + wp-corpus/cover-peta.json
Keluaran: <repo>/drizzle/data/2026-11-impor-artikel-wp/*.sql  (maks 40 artikel/file)
          <repo>/drizzle/data/2026-11-impor-artikel-wp/00-native.sql
          <repo>/drizzle/data/2026-11-impor-artikel-wp/rollback.sql
"""
import json
import os
import re
from datetime import datetime, timedelta, timezone

AKAR = os.path.dirname(os.path.abspath(__file__)) + "/wp-corpus"
_REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REPO = _REPO.replace("\\", "/")
KELUAR = f"{REPO}/drizzle/data/2026-11-impor-artikel-wp"
WIB = timezone(timedelta(hours=7))

SAMPUL_CADANGAN = "/img/artikel/sampul-panduan.webp"

HALAMAN_BARU = {
    "/", "/produk", "/paket-proyek", "/galeri", "/artikel", "/kontak", "/area-pengiriman",
    "/pola-paving", "/kredit-foto", "/privacy-policy", "/profil", "/sertifikat-tkdn",
    "/paving-block-bekasi-cikarang", "/paving-block-karawang-cikampek", "/paving-block-subang",
    "/produk/paving-block", "/produk/u-ditch", "/produk/buis-beton", "/produk/kanstin",
    "/produk/genteng-beton", "/produk/greffel-beton", "/produk/jasa-pasang-paving",
}

ATURAN_KATEGORI = [
    ("Kanstin", r"kanstin|pembatas jalan|stopper ban|taman trotoar"),
    ("U-Ditch & Saluran", r"u-?ditch|uditch|box culvert|saluran|drainase|beton got|greffel|gravel"),
    ("Buis & Gorong-gorong", r"buis|gorong|cincin beton|septic|sumur resapan"),
    ("Genteng & Atap", r"genteng|atap|nok|lisplang|overstek|tritisan|reng|spandek|trimdek|alderon|kemiringan"),
    ("Paving & Grass Block", r"paving|conblock|konblok|grass.?block|grass.?paving|truepave|fullpave|hexagon|topi uskup|ubin|stamper|abu batu|base course|nat pada|carport|trotoar|parkiran|pasang.?paving|jenis-jalan"),
    ("Beton Cor & Konstruksi", r"beton|cor|mutu|k-?\d+|fly ash|semen|pagar panel|dinding|tiang|ekskavator|jembatan|deker|lantai|sertifikat tkdn"),
]

JUDUL_ABAIKAN = re.compile(r"\s*[-|–]\s*Istana Block(\s*Purwakarta)?\s*$", re.I)


def kategori_artikel(slug, judul):
    t = f"{slug} {judul}".lower()
    for nama, pola in ATURAN_KATEGORI:
        if re.search(pola, t):
            return nama
    return "Beton Cor & Konstruksi"


def muat_redirects():
    path = f"{REPO}/src/data/legacy-redirects.json"
    if not os.path.exists(path):
        return {}
    return json.load(open(path, encoding="utf-8"))


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


def rapikan_markdown(md, sasaran, redirects):
    """Tautan internal dipetakan lewat legacy-redirects.json atau sasaran valid; HTML sisa dibuang."""
    def ganti(m):
        teks, url = m.group(1), m.group(2)
        if url.startswith("/media/"):
            return m.group(0)
        if url.startswith("http") and "istanablockpurwakarta.com" not in url:
            return m.group(0)
        jalur = re.sub(r"^https?://(www\.)?istanablockpurwakarta\.com", "", url)
        jalur = "/" + jalur.strip("/") if jalur.strip("/") else "/"
        jalur = jalur.split("?")[0].split("#")[0]
        if jalur.startswith("/media/"):
            return m.group(0)
        bersih = jalur.rstrip("/") or "/"
        # Cek peta redirect lama (mis. /genteng-beton -> /produk/genteng-beton)
        if bersih in redirects:
            tujuan = redirects[bersih]
            if tujuan == "410":
                return teks
            bersih = tujuan
        if bersih in sasaran or bersih == "/":
            return f"[{teks}]({bersih})"
        return teks

    md = re.sub(r"(?<!!)\[([^\]]+)\]\((https?://[^)\s]+|/[^)\s]*)\)", ganti, md)
    md = re.sub(r"</?[a-zA-Z][^>]{0,200}>", "", md)
    md = re.sub(r"\[/?(?:caption|gallery|embed|video|audio|playlist|contact-form-7|wpforms|vc_[a-z_]*|et_pb_[a-z_]*|su_[a-z_]*|table|row|column|button|toc)(?:\s[^\]]*)?\]", "", md, flags=re.I)
    # H1 di dalam isi membuat halaman punya dua H1 bersama judul dari template.
    md = re.sub(r"(?m)^#\s+.*$", "", md)
    md = md.replace("\u00a0", " ").replace("\u200b", "")
    md = re.sub(r"[ \t]+\n", "\n", md)
    md = re.sub(r"\n{3,}", "\n\n", md)
    md = re.sub(r"[ \t]{2,}", " ", md)
    md = re.sub(r"\n(\*\*|##?|>|-)\s*\n", "\n", md)
    # Rapikan sisa kurung siku kontak literal dari template WordPress (mis. [(0264) 200476], [cs@istanablock.com])
    md = re.sub(r"\[(\(?\d[\d\s()-]{5,}\)?|[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\](?!\()", r"\1", md)
    # Jika ada baris dengan jumlah penanda '**' ganjil (sisa tag </b> tak berpasangan dari WP), buang penanda terakhir yang menggantung
    clean_lines = []
    for ln in md.splitlines():
        if ln.count("**") % 2 == 1:
            idx = ln.rfind("**")
            ln = ln[:idx] + ln[idx + 2 :]
        clean_lines.append(ln)
    md = "\n".join(clean_lines)
    return md.strip()


def kutip(s):
    return "'" + (s or "").replace("'", "''") + "'"


def main():
    idx = json.load(open(f"{AKAR}/md/indeks.json", encoding="utf-8"))
    posts = idx["posts"]
    redirects = muat_redirects()
    cover_path = f"{AKAR}/cover-peta.json"
    cover_peta = json.load(open(cover_path, encoding="utf-8")) if os.path.exists(cover_path) else {}

    # Buang duplikat 96,8% & 3 slug halaman area yang sudah menjadi halaman root.
    panjang = {p["slug"]: p["kata"] for p in posts}
    drop = {
        "paving-block-bekasi-cikarang",
        "paving-block-karawang-cikampek",
        "paving-block-subang",
    }
    if "paving-block-murah" in panjang and "paving-block-murah-untuk-hunian" in panjang:
        drop.add("paving-block-murah" if panjang["paving-block-murah"] < panjang["paving-block-murah-untuk-hunian"] else "paving-block-murah-untuk-hunian")

    terpakai = [p for p in posts if p["slug"] not in drop]
    hanya = {s for s in os.environ.get("HANYA", "").split(",") if s}
    if hanya:
        terpakai = [p for p in terpakai if p["slug"] in hanya]
    keluar = os.environ.get("KELUAR", KELUAR)
    per_file = int(os.environ.get("PER_FILE", "40"))
    sasaran = set(HALAMAN_BARU) | {f"/artikel/{p['slug']}" for p in terpakai} | {"/artikel/cara-menghitung-kebutuhan-paving-block"}

    baris, rollback, stat = [], [], []
    kat_hitung = {}
    sumber_hitung = {"R2-featured": 0, "placeholder": 0}

    for p in terpakai:
        slug = p["slug"]
        path = f"{AKAR}/md/posts/{slug}.md"
        md = open(path, encoding="utf-8").read().split("---", 2)[-1].strip()
        md = rapikan_markdown(md, sasaran, redirects)
        if len(md.split()) < 200:
            stat.append((slug, "dilewati: <200 kata", 0))
            continue
        judul = bersihkan_judul(p["judul"]) or slug.replace("-", " ").title()
        kat = kategori_artikel(slug, judul)
        kat_hitung[kat] = kat_hitung.get(kat, 0) + 1

        info_cov = cover_peta.get(slug)
        cover_key = info_cov["key"] if (info_cov and info_cov.get("key")) else SAMPUL_CADANGAN
        if cover_key == SAMPUL_CADANGAN:
            sumber_hitung["placeholder"] += 1
        else:
            sumber_hitung["R2-featured"] += 1

        kepala = bersihkan_judul(p["judul_seo"]) or judul
        seo_judul = potong(kepala, 65)
        if len(seo_judul) < 30:
            seo_judul = potong(f"{seo_judul} | Istana Block", 65)
        ringkas = (p["deskripsi_seo"] or p["ringkas"] or "").strip().rstrip("[…] ").strip()
        if len(ringkas) < 70:
            paragraf = [x for x in md.split("\n\n") if len(x.split()) > 12 and not x.startswith(("!", "#", "|"))]
            ringkas = (paragraf[0] if paragraf else judul)
        # Bersihkan markup markdown dari ringkas/seo_description agar tampil bersih sebagai plain text
        ringkas_bersih = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", ringkas)
        ringkas_bersih = re.sub(r"[*_`]+", "", ringkas_bersih)
        ringkas_bersih = potong(ringkas_bersih, 165)
        kata = len(md.split())
        baris.append(
            "INSERT INTO articles (slug, title, category, excerpt, content, cover_key, published, published_at, seo_title, seo_description, created_at, updated_at) "
            f"VALUES ({kutip(slug)}, {kutip(judul)}, {kutip(kat)}, {kutip(ringkas_bersih)}, {kutip(md)}, {kutip(cover_key)}, 1, {waktu(p['terbit'])}, "
            f"{kutip(seo_judul)}, {kutip(ringkas_bersih)}, unixepoch(), unixepoch()) "
            f"ON CONFLICT(slug) DO UPDATE SET title=excluded.title, category=excluded.category, excerpt=excluded.excerpt, content=excluded.content, "
            f"cover_key=excluded.cover_key, published=1, published_at=excluded.published_at, seo_title=excluded.seo_title, "
            f"seo_description=excluded.seo_description, updated_at=unixepoch();"
        )
        rollback.append(f"DELETE FROM articles WHERE slug = {kutip(slug)};")
        stat.append((slug, "siap", kata))

    os.makedirs(keluar, exist_ok=True)
    for lama in os.listdir(keluar):
        p_lama = os.path.join(keluar, lama)
        if lama.endswith(".sql") and os.path.isfile(p_lama):
            os.remove(p_lama)
    for i in range(0, len(baris), per_file):
        nomor = i // per_file + 1
        with open(f"{keluar}/{nomor:02d}-artikel.sql", "w", encoding="utf-8", newline="\n") as f:
            f.write("-- Impor ulang bersih artikel WordPress (thumbnail R2 + tautan pulih + kategori).\n")
            f.write("\n".join(baris[i:i + per_file]) + "\n")

    # Update artikel asli (native) agar punya kategori & sampul konsisten bila cover_key masih kosong
    with open(f"{keluar}/00-native.sql", "w", encoding="utf-8", newline="\n") as f:
        f.write(
            f"UPDATE articles SET category = 'Paving & Grass Block', "
            f"cover_key = COALESCE(NULLIF(cover_key, ''), '{SAMPUL_CADANGAN}'), "
            f"updated_at = unixepoch() "
            f"WHERE slug = 'cara-menghitung-kebutuhan-paving-block';\n"
        )

    with open(f"{keluar}/rollback.sql", "w", encoding="utf-8", newline="\n") as f:
        f.write("-- Hapus artikel hasil impor bila perlu dibatalkan.\n" + "\n".join(rollback) + "\n")

    siap = [s for s in stat if s[1] == "siap"]
    print(f"artikel siap impor : {len(siap)}")
    print(f"  dilewati         : {len([s for s in stat if s[1] != 'siap'])}")
    print(f"  sampul R2 asli   : {sumber_hitung['R2-featured']} | placeholder: {sumber_hitung['placeholder']}")
    print(f"  kategori         : {kat_hitung}")
    print(f"  total kata       : {sum(s[2] for s in siap)}")
    if siap:
        print(f"  median kata      : {sorted(s[2] for s in siap)[len(siap) // 2]}")
    print(f"file SQL           : {len([f for f in os.listdir(keluar) if f.endswith('.sql')])} (di {keluar})")


if __name__ == "__main__":
    main()
