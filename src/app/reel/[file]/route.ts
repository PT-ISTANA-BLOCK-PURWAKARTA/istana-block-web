import { getEnv } from "@/db";

// Menyajikan video fitur dengan dukungan Range (206). Safari/iOS wajib memakai
// byte-range untuk memutar video, dan pengguna bisa menggeser timeline versi bersuara.
const FILE = /^reel-(16x9|9x16)(-suara)?\.(mp4|webm)$/;

async function load(req: Request, file: string) {
  const env = await getEnv();
  const url = new URL(`/reel-src/${file}`, req.url);
  const res = env.ASSETS ? await env.ASSETS.fetch(url) : await fetch(url);
  if (!res.ok) return null;
  return { body: await res.arrayBuffer(), etag: res.headers.get("etag") };
}

async function serve(req: Request, params: Promise<{ file: string }>, head: boolean) {
  const { file } = await params;
  if (!FILE.test(file)) return new Response("Not found", { status: 404 });
  const asset = await load(req, file);
  if (!asset) return new Response("Not found", { status: 404 });
  const size = asset.body.byteLength;
  const headers = new Headers({
    "content-type": file.endsWith(".mp4") ? "video/mp4" : "video/webm",
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=86400",
  });
  if (asset.etag) headers.set("etag", asset.etag);

  const range = req.headers.get("range");
  const m = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (m && (m[1] || m[2])) {
    let start = m[1] ? parseInt(m[1], 10) : size - parseInt(m[2], 10);
    let end = m[1] && m[2] ? parseInt(m[2], 10) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end || start >= size) {
      headers.set("content-range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    headers.set("content-range", `bytes ${start}-${end}/${size}`);
    headers.set("content-length", String(end - start + 1));
    return new Response(head ? null : asset.body.slice(start, end + 1), { status: 206, headers });
  }
  headers.set("content-length", String(size));
  return new Response(head ? null : asset.body, { status: 200, headers });
}

export function GET(req: Request, { params }: { params: Promise<{ file: string }> }) {
  return serve(req, params, false);
}

export function HEAD(req: Request, { params }: { params: Promise<{ file: string }> }) {
  return serve(req, params, true);
}
