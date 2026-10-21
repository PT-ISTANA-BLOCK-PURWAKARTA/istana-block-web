import { getCurrentAdmin } from "@/lib/auth";
import { saveFile, UploadError } from "@/lib/media";
import { can } from "@/lib/roles";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

/**
 * Unggah satu lampiran hasil rapat/training (pdf, gambar, Word, Excel, PowerPoint, maks 10 MB) ke R2 folder kalender/.
 * Lewat route handler, bukan server action, karena batas body server action hanya 6 MB.
 * Mengembalikan {key,name,contentType,size}; berkas baru terpakai setelah hasil disimpan.
 */
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return json(403, { ok: false, error: "Asal permintaan tidak dikenal." });
  const me = await getCurrentAdmin();
  if (!me || !can(me.roles, "kalender_kelola")) return json(401, { ok: false, error: "Tidak punya izin mengelola kalender." });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json(400, { ok: false, error: "Berkas tidak terbaca." });
  }
  try {
    const saved = await saveFile(form.get("file"), "kalender");
    if (!saved) return json(400, { ok: false, error: "Pilih berkas dulu." });
    return json(200, { ok: true, ...saved });
  } catch (error) {
    if (error instanceof UploadError) return json(400, { ok: false, error: error.message });
    throw error;
  }
}
