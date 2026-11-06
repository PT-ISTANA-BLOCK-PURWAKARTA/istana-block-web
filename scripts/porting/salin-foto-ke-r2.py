#!/usr/bin/env python3
"""Salin objek KV istana-block-photos -> R2 istana-block-media (nama kunci sama)."""
import json, os, pathlib, re, subprocess, sys, threading, time, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor

ACC = "a5dec0cac9600d717295b2b7699a3857"
NS = "dcb07fe980d14de5bce2d0389a7adbca"
BUCKET = "istana-block-media"
WEB = pathlib.Path(r"C:\Users\Sarimusan\Downloads\PROJECTS\ISTANA_BLOCK_PURWAKARTA\istana-block-web")
WR = WEB / "node_modules" / "wrangler" / "bin" / "wrangler.js"
TMP = pathlib.Path(os.path.expanduser("~/AppData/Local/hermes/cache/scratch/foto"))
TMP.mkdir(parents=True, exist_ok=True)
LOG = TMP / "salin.log"
ENV = dict(os.environ, CLOUDFLARE_ACCOUNT_ID=ACC, CLOUDFLARE_NO_UPDATE_NOTIFIER="1")

def token():
    cfg = pathlib.Path(os.path.expanduser("~/.wrangler/config/default.toml")).read_text()
    return re.search(r'oauth_token\s*=\s*"([^"]+)"', cfg).group(1)

def log(msg):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(msg + "\n")

def main():
    keys = json.loads(pathlib.Path(os.path.expanduser(
        "~/AppData/Local/hermes/cache/scratch/kv-keys.json")).read_text(encoding="utf-8"))
    # lanjutkan: kunci yang sudah OK di log dilewati
    sudah = set()
    if LOG.exists():
        for line in LOG.read_text(encoding="utf-8", errors="replace").splitlines():
            if line.startswith("OK "):
                parts = line.split(" ", 3)
                if len(parts) >= 4: sudah.add(parts[3].rsplit(" ", 1)[0])
    sisa = [k for k in keys if k["name"] not in sudah]
    log(f"mulai: total={len(keys)} sudah={len(sudah)} sisa={len(sisa)}")
    tok = token()
    stats = {"ok": 0, "gagal": 0}
    lock = threading.Lock()

    def satu(k):
        name = k["name"]
        ctype = (k.get("metadata") or {}).get("contentType") or "application/octet-stream"
        url = f"https://api.cloudflare.com/client/v4/accounts/{ACC}/storage/kv/namespaces/{NS}/values/{urllib.parse.quote(name, safe='')}"
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {tok}"})
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                data = r.read()
        except Exception as e:
            with lock: stats["gagal"] += 1; log(f"GAGAL ambil KV {name}: {e}")
            return
        if not data:
            with lock: stats["gagal"] += 1; log(f"GAGAL kosong {name}")
            return
        f = TMP / f"t{threading.get_ident()}.bin"
        f.write_bytes(data)
        r = subprocess.run(["node", str(WR), "r2", "object", "put", f"{BUCKET}/{name}",
                            f"--file={f}", f"--content-type={ctype}", "--remote"],
                           cwd=str(WEB), capture_output=True, text=True, timeout=240, env=ENV)
        out = (r.stdout + r.stderr).lower()
        if r.returncode != 0 or "error" in out or "unauthorized" in out:
            with lock: stats["gagal"] += 1; log(f"GAGAL unggah {name}: {(r.stdout + r.stderr)[:200]}")
        else:
            with lock: stats["ok"] += 1; log(f"OK {name} {len(data)}B")

    with ThreadPoolExecutor(max_workers=6) as ex:
        list(ex.map(satu, sisa))
    log(f"SELESAI ok={stats['ok']} gagal={stats['gagal']} dari {len(sisa)} sisa")

if __name__ == "__main__":
    main()
