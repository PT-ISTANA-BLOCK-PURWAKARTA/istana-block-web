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

/**
 * Folder R2. produk/artikel/halaman publik lewat /media; selebihnya privat lewat /operasional/bukti (pengiriman)
 * atau /operasional/berkas (penerimaan, uji-pasir, produksi, ttd, kalender).
 */
export type MediaFolder = "produk" | "artikel" | "halaman" | "pengiriman" | "penerimaan" | "uji-pasir" | "produksi" | "ttd" | "kalender";

/** Simpan gambar ke R2. Mengembalikan key, atau null bila tidak ada file. */
export async function saveImage(file: FormDataEntryValue | null, folder: MediaFolder) {
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

/** Jenis lampiran yang boleh diunggah lewat saveFile (gambar + dokumen kantor). */
export const FILE_TYPES: Record<string, string> = {
  ...TYPES,
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};
export const MAX_FILE_UPLOAD = 10 * 1024 * 1024;

export type SavedFile = { key: string; name: string; contentType: string; size: number };

/**
 * Simpan lampiran non-gambar (pdf, doc/docx, xls/xlsx, ppt/pptx) atau gambar ke R2, maks 10 MB.
 * Nama asli disimpan di customMetadata.name untuk header unduh. Mengembalikan null bila tidak ada file.
 */
export async function saveFile(
  file: FormDataEntryValue | null,
  folder: MediaFolder,
  opts: { types?: Record<string, string>; maxBytes?: number } = {},
): Promise<SavedFile | null> {
  if (!file || typeof file === "string" || file.size === 0) return null;
  const types = opts.types ?? FILE_TYPES;
  const maxBytes = opts.maxBytes ?? MAX_FILE_UPLOAD;
  const ext = types[file.type];
  if (!ext) throw new UploadError("Format berkas tidak didukung. Gunakan PDF, Word, Excel, PowerPoint, atau gambar.");
  if (file.size > maxBytes) throw new UploadError(`Ukuran berkas maksimal ${Math.round(maxBytes / (1024 * 1024))} MB.`);
  const base = slugify(file.name.replace(/\.[^.]+$/, "")) || "berkas";
  const key = `${folder}/${new Date().getUTCFullYear()}/${crypto.randomUUID().slice(0, 8)}-${base}.${ext}`;
  const env = await getEnv();
  await env.MEDIA.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type, cacheControl: "private, max-age=86400" },
    customMetadata: { name: file.name.slice(0, 200) },
  });
  return { key, name: file.name, contentType: file.type, size: file.size };
}

/** Hapus gambar lama di R2 (abaikan gambar statis bawaan yang diawali "/"). */
export async function deleteImage(key: string | null | undefined) {
  if (!key || key.startsWith("/") || key.startsWith("http")) return;
  const env = await getEnv();
  await env.MEDIA.delete(key);
}
