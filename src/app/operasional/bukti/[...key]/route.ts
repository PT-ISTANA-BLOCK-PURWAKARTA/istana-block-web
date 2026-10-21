import { and, eq } from "drizzle-orm";
import { getDb, getEnv, schema } from "@/db";
import { getCurrentAdmin } from "@/lib/auth";
import { can, canOpen } from "@/lib/roles";

// Foto bukti terima pengiriman: hanya untuk pengguna operasional/keuangan (tidak lewat /media publik).
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const me = await getCurrentAdmin();
  if (!me || !(canOpen(me.roles, "operasional") || canOpen(me.roles, "keuangan"))) return new Response("Tidak diizinkan", { status: 403 });
  const { key } = await params;
  const path = key.map(decodeURIComponent).join("/");
  if (!/^pengiriman\/[\w\-./]+$/.test(path) || path.includes("..")) return new Response("Not found", { status: 404 });
  // Sopir hanya boleh membuka foto dari surat jalan miliknya.
  if (!can(me.roles, "lihat_ops") && !canOpen(me.roles, "keuangan")) {
    const db = await getDb();
    // Foto lama (kolom proof_key) atau foto baru (ops_delivery_proofs) dari surat jalan milik sopir ini.
    const legacy = me.driverId && (await db.query.deliveries.findFirst({ where: and(eq(schema.deliveries.proofKey, path), eq(schema.deliveries.driverId, me.driverId)) }));
    const row = !legacy && me.driverId ? await db.query.deliveryProofs.findFirst({ where: eq(schema.deliveryProofs.fileKey, path) }) : undefined;
    const own = legacy || (row && (await db.query.deliveries.findFirst({ where: and(eq(schema.deliveries.id, row.deliveryId), eq(schema.deliveries.driverId, me.driverId as string)) })));
    if (!own) return new Response("Tidak diizinkan", { status: 403 });
  }
  const env = await getEnv();
  const obj = await env.MEDIA.get(path);
  if (!obj) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", "private, max-age=86400");
  headers.set("x-content-type-options", "nosniff");
  return new Response(obj.body as ReadableStream, { headers });
}
