#!/usr/bin/env python3
"""Unduh gambar isi artikel WordPress, ubah ke WebP, siapkan untuk R2.

Keluaran:
  wp-corpus/gambar/<slug>/<hash>.webp   (maks lebar 1200 px, kualitas 80)
  wp-corpus/gambar-peta.json            {url_wp: {key, berkas, lebar, tinggi, byte}}
  wp-corpus/gambar-unggah.sh            daftar perintah `wrangler r2 object put`
"""
import hashlib
import io
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

AKAR = os.path.dirname(os.path.abspath(__file__)) + "/wp-corpus"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0 migrate-images"}
BUCKET = "istana-block-media"
MAKS_LEBAR = 1200
KUALITAS = 80

# Slug yang tidak diimpor ke DB (duplikat / bertabrakan dengan halaman area).
LEWATI = {"paving-block-murah", "masih-ragu-pilih-istana-block",
          "paving-block-bekasi-cikarang", "paving-block-karang-kawarang", "paving-block-subang",
          "paving-block-karawang-cikampek"}


def kandidat(src, srcset):
    """Daftar URL calon, terbaik lebih dulu.

    WordPress sering menaruh versi kecil di `src` dan versi asli di `srcset`. Versi asli
    (tanpa akhiran -<lebar>x<tinggi>) dicoba dulu supaya foto tidak ikut kecil/buram;
    kalau 404 baru pakai srcset terbesar, lalu `src`.
    """
    asli = re.sub(r"-\d+x\d+(\.(jpg|jpeg|png|webp))$", r"\1", src, flags=re.I)
    besar = []
    for bagian in (srcset or "").split(","):
        bagian = bagian.strip().split(" ")[0]
        if bagian:
            m = re.search(r"-(\d+)x(\d+)\.(jpg|jpeg|png|webp)", bagian, re.I)
            besar.append((int(m.group(1)) if m else 0, bagian))
    besar.sort(reverse=True)
    calon = [asli] + [u for _, u in besar] + [src]
    hasil = []
    for u in calon:
        if u and u not in hasil:
            hasil.append(u)
    return hasil


def ambil(url, coba=3):
    for i in range(coba):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(1.5 * (i + 1))
        except Exception:
            time.sleep(1.5 * (i + 1))
    return None


def proses(item):
    slug = item["slug"]
    berkas_artikel = f"{AKAR}/md/posts/{slug}.md"
    if slug in LEWATI or not os.path.exists(berkas_artikel):
        return slug, []
    html = (item.get("content") or {}).get("rendered", "")
    hasil = []
    terlihat = set()
    for m in re.finditer(r"<img\b([^>]*)>", html):
        atr = m.group(1)
        src = re.search(r'\bsrc="([^"]+)"', atr)
        srcset = re.search(r'\bsrcset="([^"]+)"', atr)
        alt = re.search(r'\balt="([^"]*)"', atr)
        if not src:
            continue
        calon = kandidat(src.group(1), srcset.group(1) if srcset else "")
        url = calon[0]
        if url in terlihat:
            continue
        terlihat.add(url)
        hasil.append({"url": url, "calon": calon, "url_asli": src.group(1),
                      "alt": (alt.group(1) if alt else "").strip()})
    return slug, hasil


def main():
    posts = json.load(open(f"{AKAR}/raw/posts.json", encoding="utf-8"))
    os.makedirs(f"{AKAR}/gambar", exist_ok=True)
    peta, tugas = {}, []
    for it in posts:
        slug, gambar = proses(it)
        for g in gambar:
            tugas.append((slug, g))

    print(f"gambar unik akan diproses: {len({t[1]['url'] for t in tugas})} dari {len(tugas)} slot")

    def kerjakan(pasangan):
        slug, g = pasangan
        key = None
        kunci_hash = hashlib.sha1(g["url"].encode()).hexdigest()[:10]
        tujuan = f"artikel/{slug}/{kunci_hash}.webp"
        path = f"{AKAR}/gambar/{slug}"
        os.makedirs(path, exist_ok=True)
        keluaran = f"{path}/{kunci_hash}.webp"
        if os.path.exists(keluaran):
            return g["url"], {"key": tujuan, "berkas": keluaran, "byte": os.path.getsize(keluaran)}
        data, dipakai = None, None
        for u in g.get("calon") or [g["url"]]:
            data = ambil(u)
            if data:
                dipakai = u
                break
        if not data:
            return g["url"], {"key": None, "galat": "unduh gagal"}
        try:
            im = Image.open(io.BytesIO(data))
            im.load()
        except Exception as e:
            return g["url"], {"key": None, "galat": f"bukan gambar: {e}"}
        if im.mode in ("P", "RGBA", "LA"):
            latar = Image.new("RGB", im.size, (255, 255, 255))
            latar.paste(im.convert("RGBA"), mask=im.convert("RGBA").split()[-1])
            im = latar
        elif im.mode != "RGB":
            im = im.convert("RGB")
        if im.width > MAKS_LEBAR:
            im = im.resize((MAKS_LEBAR, round(im.height * MAKS_LEBAR / im.width)), Image.LANCZOS)
        im.save(keluaran, "WEBP", quality=KUALITAS, method=5)
        return g["url"], {"key": tujuan, "berkas": keluaran, "lebar": im.width, "tinggi": im.height,
                          "byte": os.path.getsize(keluaran), "dipakai": dipakai}

    unik = {}
    with ThreadPoolExecutor(max_workers=8) as ex:
        for url, info in ex.map(kerjakan, tugas):
            if url not in unik or (info.get("key") and not unik[url].get("key")):
                unik[url] = info

    berhasil = {k: v for k, v in unik.items() if v.get("key")}
    gagal = {k: v for k, v in unik.items() if not v.get("key")}
    print(f"berhasil: {len(berhasil)} gambar | gagal: {len(gagal)}")
    total = sum(v["byte"] for v in berhasil.values())
    print(f"total ukuran WebP: {total/1024/1024:.1f} MB (rata-rata {total/max(1,len(berhasil))/1024:.0f} KB)")
    for k, v in list(gagal.items())[:5]:
        print("  gagal:", k[:90], v.get("galat"))

    json.dump(berhasil, open(f"{AKAR}/gambar-peta.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    with open(f"{AKAR}/gambar-unggah.sh", "w", encoding="utf-8", newline="\n") as f:
        f.write("#!/bin/sh\nset -e\n")
        for key, v in sorted((v["key"], v) for v in berhasil.values()):
            asal = "/mnt/c" + v["berkas"].replace("C:", "").replace("\\", "/")
            f.write(f"npx wrangler r2 object put {BUCKET}/{key} --file '{asal}' "
                    f"--content-type image/webp --content-disposition inline "
                    f"--cache-control 'public, max-age=31536000, immutable' --remote\n")
    print("daftar unggah:", f"{AKAR}/gambar-unggah.sh")


if __name__ == "__main__":
    sys.exit(main())
