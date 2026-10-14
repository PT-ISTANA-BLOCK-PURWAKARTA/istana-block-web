import "server-only";
import { getEnv } from "@/db";
import { slugify } from "./format";

const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};
export const MAX_UPLOAD = 5 * 1024 * 1024;

export class UploadError extends Error {}

/** Simpan gambar ke R2. Mengembalikan key, atau null bila tidak ada file. */
export async function saveImage(file: FormDataEntryValue | null, folder: "produk" | "artikel" | "halaman") {
  if (!file || typeof file === "string" || file.size === 0) return null;
  const ext = TYPES[file.type];
  if (!ext) throw new UploadError("Format gambar harus JPG, PNG, WebP, AVIF, atau GIF.");
  if (file.size > MAX_UPLOAD) throw new UploadError("Ukuran gambar maksimal 5 MB.");
  const base = slugify(file.name.replace(/\.[^.]+$/, "")) || "gambar";
  const now = new Date();
  const key = `${folder}/${now.getUTCFullYear()}/${crypto.randomUUID().slice(0, 8)}-${base}.${ext}`;
  const env = await getEnv();
  await env.MEDIA.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" },
  });
  return key;
}

/** Hapus gambar lama di R2 (abaikan gambar statis bawaan yang diawali "/"). */
export async function deleteImage(key: string | null | undefined) {
  if (!key || key.startsWith("/") || key.startsWith("http")) return;
  const env = await getEnv();
  await env.MEDIA.delete(key);
}
