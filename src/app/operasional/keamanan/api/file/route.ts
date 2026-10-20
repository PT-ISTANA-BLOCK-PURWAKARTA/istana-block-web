import { getEnv } from "@/db";
import { forbidden, owner } from "../guard";

/** Unduh satu berkas R2 untuk disalin ke folder backup: ?key=folder/berkas.ext */
export async function GET(req: Request) {
  if (!(await owner())) return forbidden();
  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (!key || key.length > 512 || key.startsWith("/") || key.includes("..")) return new Response("Kunci tidak valid", { status: 400 });
  const env = await getEnv();
  const obj = await env.MEDIA.get(key);
  if (!obj) return new Response("Tidak ditemukan", { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-length", String(obj.size));
  return new Response(obj.body as ReadableStream, { headers });
}
