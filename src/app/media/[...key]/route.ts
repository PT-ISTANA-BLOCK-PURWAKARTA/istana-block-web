import { getEnv } from "@/db";

// Menyajikan gambar yang diunggah ke R2. Key berisi UUID, jadi aman di-cache lama.
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const path = key.map(decodeURIComponent).join("/");
  if (!/^(produk|artikel|halaman)\/[\w\-./]+$/.test(path) || path.includes("..")) return new Response("Not found", { status: 404 });
  const env = await getEnv();
  const obj = await env.MEDIA.get(path);
  if (!obj) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(obj.body as ReadableStream, { headers });
}
