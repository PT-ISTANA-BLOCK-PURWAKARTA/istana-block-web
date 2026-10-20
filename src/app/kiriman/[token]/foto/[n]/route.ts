import { getDb, getEnv } from "@/db";
import { TOKEN_RE, trackingProofKey } from "@/lib/ops/deliveries";

// Foto bukti untuk halaman lacak publik: hanya lewat token rahasia surat jalannya (tanpa login). Nomor foto 0-based.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string; n: string }> }) {
  const { token, n } = await params;
  if (!TOKEN_RE.test(token) || !/^\d{1,2}$/.test(n)) return new Response("Not found", { status: 404 });
  const db = await getDb();
  const key = await trackingProofKey(db, token, Number(n));
  if (!key || !/^pengiriman\/[\w\-./]+$/.test(key) || key.includes("..")) return new Response("Not found", { status: 404 });
  const env = await getEnv();
  const obj = await env.MEDIA.get(key);
  if (!obj) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", "private, max-age=300");
  headers.set("x-robots-tag", "noindex, nofollow");
  headers.set("x-content-type-options", "nosniff");
  return new Response(obj.body as ReadableStream, { headers });
}
