import { getEnv } from "@/db";
import { forbidden, json, owner } from "../guard";

/** Daftar berkas R2 (foto, tanda tangan, lampiran) per 1000: ?cursor= → { files: [{key,size}], cursor }. */
export async function GET(req: Request) {
  if (!(await owner())) return forbidden();
  const cursor = new URL(req.url).searchParams.get("cursor") || undefined;
  const env = await getEnv();
  const page = await env.MEDIA.list({ cursor, limit: 1000 });
  return json({ files: page.objects.map((o) => ({ key: o.key, size: o.size })), cursor: page.truncated ? page.cursor : null });
}
