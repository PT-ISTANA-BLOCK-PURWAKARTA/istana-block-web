#!/usr/bin/env node
/**
 * Simulasi alat GPS untuk presentasi: mengirim posisi truk data contoh ke penerima GPS aplikasi
 * (format OsmAnd, sama seperti alat sungguhan), sehingga di Operasional → Lacak truk truk terlihat bergerak.
 *
 *   node scripts/demo/simulasi-gps.mjs --url https://istana-block-demo.<akun>.workers.dev
 *   node scripts/demo/simulasi-gps.mjs --url http://localhost:8787 --interval 5
 *
 * Kunci penerima memakai kunci data contoh ("demo-istana-gps-2026", diatur oleh seed/demo-erp.sql).
 * Bila kunci diganti di Lacak truk → Pengaturan GPS, isi --key dengan kunci baru.
 * Hentikan dengan Ctrl+C. Truk berhenti sendiri setelah sampai, bongkar ±10 menit, lalu pulang ke pabrik.
 */
const args = process.argv.slice(2);
const get = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const BASE = (get("url") ?? "").replace(/\/+$/, "");
if (!/^https?:\/\//.test(BASE)) {
  console.error("Pakai: node scripts/demo/simulasi-gps.mjs --url https://alamat-worker-demo [--interval 10] [--key KUNCI]");
  process.exit(1);
}
const KEY = get("key", "demo-istana-gps-2026");
const INTERVAL = Math.max(3, Number(get("interval", 10)));
const SPEEDUP = Math.max(1, Number(get("percepat", 3))); // 3 = perjalanan 3× lebih cepat dari aslinya

const HOME = [-6.5569, 107.4431];
// Jalur kasar (perkiraan) dari pabrik ke tujuan pengiriman contoh hari ini.
const TRUCKS = [
  { id: "864895031234567", plate: "T 8417 BD", route: [HOME, [-6.5100, 107.452], [-6.445, 107.46], [-6.418, 107.452], [-6.398, 107.428], [-6.37, 107.38], [-6.34, 107.34], [-6.3055, 107.3051]] },
  { id: "864895031234575", plate: "T 8593 BC", route: [HOME, [-6.542, 107.45], [-6.51, 107.452], [-6.475, 107.458], [-6.43, 107.452], [-6.412, 107.44], [-6.401, 107.429]] },
  { id: "864895031234583", plate: "T 9125 AB", route: [HOME, [-6.548, 107.465], [-6.532, 107.493], [-6.519, 107.513], [-6.5084, 107.5303]] },
];

const km = (a, b) => {
  const R = 6371;
  const dl = ((b[0] - a[0]) * Math.PI) / 180;
  const dn = ((b[1] - a[1]) * Math.PI) / 180;
  const x = Math.sin(dl / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dn / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
const bearing = (a, b) => ((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI + 360) % 360;

for (const t of TRUCKS) {
  t.leg = 0;
  t.pos = [...t.route[0]];
  t.wait = 0;
  t.dir = 1;
  t.offset = Math.random() * 3; // supaya tidak berangkat bersamaan
}

async function send(t, speed, heading) {
  const q = new URLSearchParams({ id: t.id, lat: t.pos[0].toFixed(6), lon: t.pos[1].toFixed(6), speed: String((speed / 1.852).toFixed(1)), bearing: String(Math.round(heading)), timestamp: String(Math.floor(Date.now() / 1000)), accuracy: "8" });
  try {
    const r = await fetch(`${BASE}/api/lacak/gps?key=${encodeURIComponent(KEY)}&${q}`);
    return r.status;
  } catch (e) {
    return e.message;
  }
}

async function tick() {
  for (const t of TRUCKS) {
    if (t.offset > 0) {
      t.offset--;
      continue;
    }
    let speed = 0;
    let heading = 0;
    if (t.wait > 0) {
      t.wait--;
    } else {
      // Maju sejauh kecepatan × waktu (dipercepat).
      speed = 30 + Math.random() * 18;
      let move = (speed * SPEEDUP * INTERVAL) / 3600;
      while (move > 0) {
        const next = t.route[t.leg + t.dir];
        if (!next) {
          t.wait = Math.round(600 / SPEEDUP / INTERVAL);
          t.dir = -t.dir;
          speed = 0;
          break;
        }
        const d = km(t.pos, next);
        heading = bearing(t.pos, next);
        if (d <= move) {
          t.pos = [...next];
          t.leg += t.dir;
          move -= d;
        } else {
          const f = move / d;
          t.pos = [t.pos[0] + (next[0] - t.pos[0]) * f, t.pos[1] + (next[1] - t.pos[1]) * f];
          move = 0;
        }
      }
    }
    const res = await send(t, speed, heading);
    console.log(`${new Date().toLocaleTimeString("id-ID")} ${t.plate.padEnd(10)} ${t.pos[0].toFixed(5)}, ${t.pos[1].toFixed(5)} ${speed ? `${Math.round(speed)} km/j` : "berhenti"} → ${res}`);
  }
}

console.log(`Mengirim posisi ${TRUCKS.length} truk ke ${BASE} tiap ${INTERVAL} detik. Ctrl+C untuk berhenti.`);
await tick();
setInterval(tick, INTERVAL * 1000);
