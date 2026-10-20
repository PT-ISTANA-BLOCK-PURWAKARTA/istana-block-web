import { getEnv } from "@/db";
import { getCurrentAdmin } from "@/lib/auth";
import { can } from "@/lib/roles";

// Foto & lampiran operasional (barang masuk, uji pasir, produksi, tanda tangan, kalender): hanya untuk pengguna
// yang boleh membuka operasional. Tidak lewat /media publik.
const FOLDERS = /^(penerimaan|uji-pasir|produksi|ttd|kalender)\/[\w\-./]+$/;

export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const me = await getCurrentAdmin();
  if (!me || !can(me.roles, "lihat_ops")) return new Response("Tidak diizinkan", { status: 403 });
  const { key } = await params;
  let path: string;
  try {
    path = key.map(decodeURIComponent).join("/");
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!FOLDERS.test(path) || path.includes("..")) return new Response("Not found", { status: 404 });
  const env = await getEnv();
  const obj = await env.MEDIA.get(path);
  if (!obj) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", "private, max-age=86400");
  headers.set("x-content-type-options", "nosniff");
  // Gambar & PDF dibuka di browser; dokumen Office diunduh dengan nama aslinya.
  const type = headers.get("content-type") ?? "";
  const inline = type.startsWith("image/") || type === "application/pdf";
  const name = obj.customMetadata?.name;
  if (name) headers.set("content-disposition", `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(name)}`);
  else if (!inline) headers.set("content-disposition", "attachment");
  return new Response(obj.body as ReadableStream, { headers });
}
