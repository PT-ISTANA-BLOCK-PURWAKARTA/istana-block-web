// Membuat kunci VAPID untuk Web Push (pengingat kalender dll.).
// Kunci disimpan di .dev.vars (sudah di-gitignore) untuk pengembangan lokal; kunci privat TIDAK dicetak.
//
// Pakai:  node scripts/make-vapid-keys.mjs
// Lalu pasang di Cloudflare:
//   1. Kunci publik: salin yang dicetak ke "vars" -> "VAPID_PUBLIC_KEY" di wrangler.jsonc.
//   2. Kunci privat (secret): npx wrangler secret put VAPID_PRIVATE_KEY
//      lalu tempel nilai VAPID_PRIVATE_KEY=... dari .dev.vars (JSON di dalam tanda petik tunggal, tanpa petiknya).
// Jangan buat ulang kunci bila sudah dipakai: langganan HP yang lama berhenti bekerja bila kunci diganti.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const devVars = path.join(root, ".dev.vars");
const lines = fs.existsSync(devVars) ? fs.readFileSync(devVars, "utf8").split(/\r?\n/).filter(Boolean) : [];
if (lines.some((line) => line.startsWith("VAPID_PRIVATE_KEY="))) {
  const pub = lines.find((line) => line.startsWith("VAPID_PUBLIC_KEY="));
  console.log("Kunci sudah ada di .dev.vars, tidak dibuat ulang (langganan HP lama akan rusak bila kunci diganti).");
  if (pub) console.log(`Kunci publik VAPID: ${pub.slice("VAPID_PUBLIC_KEY=".length)}`);
  process.exit(0);
}
const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const publicBase64Url = Buffer.from(new Uint8Array(await crypto.subtle.exportKey("raw", publicKey))).toString("base64url");
const jwk = JSON.stringify(await crypto.subtle.exportKey("jwk", privateKey));
const keep = lines.filter((line) => !line.startsWith("VAPID_PUBLIC_KEY=") && !line.startsWith("VAPID_PRIVATE_KEY="));
fs.writeFileSync(devVars, [...keep, `VAPID_PUBLIC_KEY=${publicBase64Url}`, `VAPID_PRIVATE_KEY='${jwk}'`].join("\n") + "\n");
console.log(`Kunci publik VAPID: ${publicBase64Url}`);
console.log("Kunci privat ditulis ke .dev.vars (VAPID_PRIVATE_KEY). Pasang sebagai secret: npx wrangler secret put VAPID_PRIVATE_KEY");
