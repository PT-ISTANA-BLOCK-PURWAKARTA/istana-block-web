// Memo hasil query D1 untuk halaman publik, per isolate Worker, dengan TTL pendek.
//
// Hanya NILAI yang sudah selesai disimpan, bukan promise yang sedang berjalan: promise D1 milik
// satu request tidak boleh ditunggu request lain di workerd. Nilai null/undefined tidak disimpan,
// jadi slug yang baru terbit tidak terkunci 404 dan slug acak tidak memenuhi memo.
// Hanya dipakai untuk data publik yang tidak dibaca panel (panel membaca langsung dari DB).
const store = new Map<string, { expires: number; value: unknown }>();
const MAX_ENTRIES = 200;

export const PUBLIC_DATA_TTL_MS = 30_000;

export async function memo<T>(key: string, load: () => Promise<T>, ttlMs = PUBLIC_DATA_TTL_MS): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value as T;
  const value = await load();
  if (value !== null && value !== undefined) {
    store.delete(key);
    store.set(key, { expires: now + ttlMs, value });
    while (store.size > MAX_ENTRIES) store.delete(store.keys().next().value as string);
  }
  return value;
}
