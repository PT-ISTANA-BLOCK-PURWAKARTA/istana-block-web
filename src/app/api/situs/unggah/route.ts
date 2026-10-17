import { getCurrentAdmin } from "@/lib/auth";
import { imageUrl } from "@/lib/format";
import { saveImage, UploadError } from "@/lib/media";
import { can } from "@/lib/roles";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const FOLDERS = ["artikel", "halaman", "produk"] as const;

/**
 * Unggah gambar dari editor isi (artikel, halaman, deskripsi produk). Gambar disimpan di R2 dan
 * alamatnya disisipkan ke isi sebagai ![keterangan](/media/…).
 */
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return json(403, { ok: false, error: "Asal permintaan tidak dikenal." });
  const me = await getCurrentAdmin();
  if (!me || !can(me.roles, "web")) return json(401, { ok: false, error: "Sesi berakhir. Masuk lagi ke Situs." });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json(400, { ok: false, error: "Berkas tidak terbaca." });
  }
  const folder = FOLDERS.find((f) => f === form.get("folder")) ?? "artikel";
  try {
    const key = await saveImage(form.get("file"), folder);
    if (!key) return json(400, { ok: false, error: "Pilih gambar dulu." });
    return json(200, { ok: true, key, url: imageUrl(key) });
  } catch (e) {
    if (e instanceof UploadError) return json(400, { ok: false, error: e.message });
    throw e;
  }
}
