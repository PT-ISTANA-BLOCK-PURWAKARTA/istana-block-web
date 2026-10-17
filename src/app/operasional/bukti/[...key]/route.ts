import { getEnv } from "@/db";
import { getCurrentAdmin } from "@/lib/auth";
import { canOpen } from "@/lib/roles";

// Foto bukti terima pengiriman: hanya untuk pengguna operasional/keuangan (tidak lewat /media publik).
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const me = await getCurrentAdmin();
  if (!me || !(canOpen(me.roles, "operasional") || canOpen(me.roles, "keuangan"))) return new Response("Tidak diizinkan", { status: 403 });
  const { key } = await params;
  const path = key.map(decodeURIComponent).join("/");
  if (!/^pengiriman\/[\w\-./]+$/.test(path) || path.includes("..")) return new Response("Not found", { status: 404 });
  const env = await getEnv();
  const obj = await env.MEDIA.get(path);
  if (!obj) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", "private, max-age=86400");
  return new Response(obj.body as ReadableStream, { headers });
}
