#!/usr/bin/env python3
"""Unduh gambar isi & thumbnail sampul (featured_media) artikel WordPress -> WebP untuk R2.

Keluaran:
  wp-corpus/gambar/<slug>/<hash>.webp   (maks lebar 1200 px, kualitas 80)
  wp-corpus/gambar-peta.json            {url_wp: {key, berkas, lebar, tinggi, byte}}
  wp-corpus/cover-peta.json             {slug: {key, url, sumber, lebar, tinggi}}
  wp-corpus/gambar-unggah.sh            daftar perintah `wrangler r2 object put` lengkap
  wp-corpus/gambar-unggah-baru.txt      daftar "key|berkas" yang baru dibuat / belum ada di peta lama
"""
import hashlib
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

AKAR = os.path.dirname(os.path.abspath(__file__)) + "/wp-corpus"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0 migrate-images"}
BUCKET = "istana-block-media"
MAKS_LEBAR = 1200
KUALITAS = 80

# Slug yang tidak diimpor ke DB artikel (duplikat / stub / halaman area root).
LEWATI = {
    "paving-block-murah",
    "masih-ragu-pilih-istana-block",
    "paving-block-bekasi-cikarang",
    "paving-block-karang-kawarang",
    "paving-block-subang",
    "paving-block-karawang-cikampek",
}


def kandidat(src, srcset=""):
    """Daftar URL calon, terbaik lebih dulu (versi asli sebelum -WxH)."""
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


def ambil(url, coba=3):
    # Encode karakter non-ASCII pada path URL (mis. tanda '×' di nama file gambar).
    sp = urllib.parse.urlsplit(url)
    encoded_url = urllib.parse.urlunsplit((
        sp.scheme,
        sp.netloc,
        urllib.parse.quote(urllib.parse.unquote(sp.path), safe="/:@!$&'()*+,;=-._~"),
        sp.query,
        sp.fragment,
    ))
    for i in range(coba):
        try:
            with urllib.request.urlopen(urllib.request.Request(encoded_url, headers=UA), timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(1.5 * (i + 1))
        except Exception:
            time.sleep(1.5 * (i + 1))
    return None


def ekstrak_gambar_html(html):
    hasil = []
    terlihat = set()
    for m in re.finditer(r"<img\b([^>]*)>", html or ""):
        atr = m.group(1)
        src = (
            re.search(r'\bdata-lazy-src="([^"]+)"', atr)
            or re.search(r'\bdata-src="([^"]+)"', atr)
            or re.search(r'\bsrc="([^"]+)"', atr)
        )
        srcset = re.search(r'\bsrcset="([^"]+)"', atr)
        alt = re.search(r'\balt="([^"]*)"', atr)
        if not src:
            continue
        raw_src = src.group(1).strip()
        if not raw_src or raw_src.startswith("data:"):
            continue
        calon = kandidat(raw_src, srcset.group(1) if srcset else "")
        if not calon:
            continue
        url = calon[0]
        if url in terlihat:
            continue
        terlihat.add(url)
        hasil.append({
            "url": url,
            "calon": calon,
            "url_asli": raw_src,
            "alt": (alt.group(1) if alt else "").strip(),
        })
    return hasil


def kandidat_sampul(item, media_by_id, inline_imgs):
    """Kandidat URL thumbnail sampul: featured_media -> og_image -> gambar pertama di isi."""
    calon = []
    sumber = None
    fm_id = str(item.get("featured_media") or "")
    if fm_id and fm_id != "0" and fm_id in media_by_id:
        m = media_by_id[fm_id]
        src_url = m.get("source_url")
        if src_url:
            calon.extend(kandidat(src_url))
            # Tambahkan sizes terbesar jika source_url 404
            sizes = list((m.get("sizes") or {}).values())
            for su in reversed(sizes):
                if su and su not in calon:
                    calon.append(su)
            sumber = "featured_media"
    # Fallback ke Yoast og_image
    og_list = (item.get("yoast_head_json") or {}).get("og_image") or []
    for og in og_list:
        u = og.get("url") if isinstance(og, dict) else None
        if u:
            for c in kandidat(u):
                if c not in calon:
                    calon.append(c)
            if not sumber:
                sumber = "og_image"
    # Fallback ke gambar isi pertama
    if not calon and inline_imgs:
        for c in inline_imgs[0]["calon"]:
            if c not in calon:
                calon.append(c)
        sumber = "inline_first"
    return calon, sumber


def main():
    posts = json.load(open(f"{AKAR}/raw/posts.json", encoding="utf-8"))
    halaman = json.load(open(f"{AKAR}/raw/pages.json", encoding="utf-8"))
    media_path = f"{AKAR}/raw/media_by_id.json"
    media_by_id = json.load(open(media_path, encoding="utf-8")) if os.path.exists(media_path) else {}

    peta_lama_path = f"{AKAR}/gambar-peta.json"
    peta_lama = json.load(open(peta_lama_path, encoding="utf-8")) if os.path.exists(peta_lama_path) else {}
    kunci_lama = {v["key"] for v in peta_lama.values() if isinstance(v, dict) and v.get("key")}

    os.makedirs(f"{AKAR}/gambar", exist_ok=True)
    tugas = []
    sampul_plan = {}  # slug -> (calon, sumber)

    for it in posts:
        slug = it["slug"]
        if slug in LEWATI:
            continue
        imgs = ekstrak_gambar_html((it.get("content") or {}).get("rendered", ""))
        for g in imgs:
            tugas.append((slug, g, "artikel"))
        calon_sampul, sumber = kandidat_sampul(it, media_by_id, imgs)
        if calon_sampul:
            sampul_plan[slug] = (calon_sampul, sumber)
            tugas.append((slug, {"url": calon_sampul[0], "calon": calon_sampul, "url_asli": calon_sampul[0], "alt": ""}, "artikel"))

    for it in halaman:
        slug = it["slug"]
        if slug in LEWATI:
            continue
        imgs = ekstrak_gambar_html((it.get("content") or {}).get("rendered", ""))
        for g in imgs:
            tugas.append((slug, g, "halaman"))

    # Deduplikasi tugas per (awalan, slug, url)
    dedup = {}
    for slug, g, awalan in tugas:
        k = (awalan, slug, g["url"])
        if k not in dedup:
            dedup[k] = (slug, g, awalan)
    tugas_unik = list(dedup.values())
    print(f"gambar unik akan diproses: {len(tugas_unik)} (dari {len(sampul_plan)} post bersampul)")

    baru_dibuat = set()

    def kerjakan(pasangan):
        slug, g, awalan = pasangan
        kunci_hash = hashlib.sha1(g["url"].encode()).hexdigest()[:10]
        tujuan = f"{awalan}/{slug}/{kunci_hash}.webp"
        path = f"{AKAR}/gambar/{slug}"
        os.makedirs(path, exist_ok=True)
        keluaran = f"{path}/{kunci_hash}.webp"
        if os.path.exists(keluaran) and os.path.getsize(keluaran) > 0:
            try:
                with Image.open(keluaran) as im:
                    w, h = im.size
            except Exception:
                w, h = None, None
            return g["url"], {"key": tujuan, "berkas": keluaran, "lebar": w, "tinggi": h, "byte": os.path.getsize(keluaran), "baru": tujuan not in kunci_lama}
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
            rgba = im.convert("RGBA")
            latar = Image.new("RGB", rgba.size, (255, 255, 255))
            latar.paste(rgba, mask=rgba.split()[-1])
            im = latar
        elif im.mode != "RGB":
            im = im.convert("RGB")
        if im.width > MAKS_LEBAR:
            im = im.resize((MAKS_LEBAR, round(im.height * MAKS_LEBAR / im.width)), Image.LANCZOS)
        im.save(keluaran, "WEBP", quality=KUALITAS, method=5)
        return g["url"], {
            "key": tujuan,
            "berkas": keluaran,
            "lebar": im.width,
            "tinggi": im.height,
            "byte": os.path.getsize(keluaran),
            "dipakai": dipakai,
            "baru": True,
        }

    unik = {}
    with ThreadPoolExecutor(max_workers=8) as ex:
        for url, info in ex.map(kerjakan, tugas_unik):
            if url not in unik or (info.get("key") and not unik[url].get("key")):
                unik[url] = info

    berhasil = {k: v for k, v in unik.items() if v.get("key")}
    gagal = {k: v for k, v in unik.items() if not v.get("key")}
    print(f"berhasil: {len(berhasil)} gambar | gagal: {len(gagal)}")
    total = sum(v["byte"] for v in berhasil.values())
    print(f"total ukuran WebP: {total/1024/1024:.1f} MB (rata-rata {total/max(1,len(berhasil))/1024:.0f} KB)")
    for k, v in list(gagal.items())[:10]:
        print("  gagal:", k[:90], v.get("galat"))

    # Bangun cover-peta.json untuk setiap slug post
    cover_peta = {}
    for slug, (calon, sumber) in sampul_plan.items():
        url = calon[0]
        info = berhasil.get(url)
        if not info:
            # Cek jika salah satu kandidat lain ada di berhasil
            for c in calon:
                if c in berhasil:
                    info = berhasil[c]
                    url = c
                    break
        if info and info.get("key"):
            cover_peta[slug] = {
                "key": info["key"],
                "berkas": info["berkas"],
                "url": url,
                "sumber": sumber,
                "lebar": info.get("lebar"),
                "tinggi": info.get("tinggi"),
            }
    print(f"cover sampul berhasil dipetakan: {len(cover_peta)}/{len(sampul_plan)} post bersampul")

    # Bersihkan flag sementara sebelum simpan JSON
    baru_list = []
    for v in berhasil.values():
        if v.pop("baru", False) or v["key"] not in kunci_lama:
            baru_list.append((v["key"], v["berkas"]))

    json.dump(berhasil, open(f"{AKAR}/gambar-peta.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(cover_peta, open(f"{AKAR}/cover-peta.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    with open(f"{AKAR}/gambar-unggah.sh", "w", encoding="utf-8", newline="\n") as f:
        f.write("#!/bin/sh\nset -e\n")
        for key, v in sorted((v["key"], v) for v in berhasil.values()):
            asal = "/mnt/c" + v["berkas"].replace("C:", "").replace("c:", "").replace("\\", "/")
            f.write(f"npx wrangler r2 object put {BUCKET}/{key} --file '{asal}' "
                    f"--content-type image/webp --content-disposition inline "
                    f"--cache-control 'public, max-age=31536000, immutable' --remote\n")

    with open(f"{AKAR}/gambar-unggah-baru.txt", "w", encoding="utf-8", newline="\n") as f:
        for key, berkas in sorted(set(baru_list)):
            asal = "/mnt/c" + berkas.replace("C:", "").replace("c:", "").replace("\\", "/")
            f.write(f"{key}|{asal}\n")

    print(f"gambar baru/perlu unggah R2: {len(set(baru_list))} -> {AKAR}/gambar-unggah-baru.txt")


if __name__ == "__main__":
    sys.exit(main())
