// Backup sekali klik dari komputer kantor ke sebuah folder (mis. folder server kantor). Hanya di browser (klien).
// Memakai File System Access API (Chrome/Edge di komputer): folder dipilih sekali, pegangannya diingat di IndexedDB.
// Server hanya menyediakan data per halaman lewat /operasional/keamanan/api/*; tidak ada yang dikirim ke luar.

const API = "/operasional/keamanan/api";
/** Baris per permintaan: cukup kecil agar tiap permintaan ke Worker tetap ringan. */
const PAGE = 300;

type PermissionMode = { mode: "read" | "readwrite" };
export type DirHandle = FileSystemDirectoryHandle & {
  queryPermission?: (options: PermissionMode) => Promise<PermissionState>;
  requestPermission?: (options: PermissionMode) => Promise<PermissionState>;
};
type Picker = (options?: { mode?: "read" | "readwrite"; id?: string }) => Promise<DirHandle>;
type Writable = { write: (data: string | Blob) => Promise<void>; close: () => Promise<void> };
type FileHandleW = FileSystemFileHandle & { createWritable: () => Promise<Writable> };

export type Progress = { phase: string; done: number; total: number };
type Manifest = { generatedAt: number; tables: { name: string; sql: string; rows: number; schemaOnly: boolean }[]; indexes: string[] };

export const folderPickerSupported = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}/${path}`, { cache: "no-store", ...init });
  if (response.redirected) throw new Error("Sesi berakhir. Masuk lagi lalu ulangi.");
  if (!response.ok) {
    let message = `Permintaan gagal (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // tubuh bukan JSON
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

// "Pegangan" folder disimpan di IndexedDB agar tidak perlu memilih ulang setiap minggu.
function idb<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    const open = indexedDB.open("istana-backup", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("handles");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const request = run(open.result.transaction("handles", mode).objectStore("handles"));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    };
  });
}

export async function savedFolder(): Promise<DirHandle | null> {
  try {
    return (await idb<DirHandle | undefined>("readonly", (store) => store.get("folder") as IDBRequest<DirHandle | undefined>)) ?? null;
  } catch {
    return null;
  }
}

export async function pickFolder() {
  const picker = (window as unknown as { showDirectoryPicker: Picker }).showDirectoryPicker;
  const handle = await picker({ mode: "readwrite", id: "istana-backup" });
  await idb("readwrite", (store) => store.put(handle, "folder"));
  return handle;
}

async function ensurePermission(handle: DirHandle) {
  if (!handle.queryPermission || !handle.requestPermission) return true;
  if ((await handle.queryPermission({ mode: "readwrite" })) === "granted") return true;
  return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
}

const sqlValue = (value: unknown) => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `'${text.replace(/'/g, "''")}'`;
};
const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
};

/** Tulis isi database sebagai berkas .sql (CREATE lalu INSERT; bisa dipakai memulihkan data) lewat penulis bertahap. */
export async function writeDatabase(write: (text: string) => Promise<void>, onProgress: (progress: Progress) => void) {
  const manifest = await api<Manifest>("manifest");
  const total = manifest.tables.reduce((sum, table) => sum + table.rows, 0);
  let done = 0;
  await write(`-- Backup aplikasi PT Istana Block (operasional)\n-- Dibuat: ${new Date().toLocaleString("id-ID")}\n-- Tabel: ${manifest.tables.length}, baris: ${total}. Isi tabel yang bertanda "hanya struktur" sengaja tidak disimpan.\nPRAGMA defer_foreign_keys=TRUE;\n`);
  // Semua tabel dibuat dulu, baru isinya, agar relasi antartabel tidak gagal saat dipulihkan.
  await write(`\n${manifest.tables.map((table) => `${table.sql};`).join("\n")}\n`);
  for (const table of manifest.tables) {
    if (table.schemaOnly) {
      await write(`\n-- ${table.name}: hanya struktur\n`);
      continue;
    }
    await write(`\n-- ${table.name}: ${table.rows} baris\n`);
    for (let offset = 0; offset < table.rows; offset += PAGE) {
      const { rows } = await api<{ rows: Record<string, unknown>[] }>(`rows?table=${encodeURIComponent(table.name)}&offset=${offset}&limit=${PAGE}`);
      if (!rows.length) break;
      const columns = Object.keys(rows[0]).map(quote).join(",");
      await write(rows.map((row) => `INSERT INTO ${quote(table.name)} (${columns}) VALUES (${Object.values(row).map(sqlValue).join(",")});`).join("\n") + "\n");
      done += rows.length;
      onProgress({ phase: `Database: ${table.name}`, done, total });
    }
  }
  await write(`\n${manifest.indexes.map((sql) => `${sql};`).join("\n")}\n`);
  return { tables: manifest.tables.length, rows: done };
}

/** Berkas yang sudah ada dengan ukuran sama dilewati (kunci R2 acak dan tidak pernah ditimpa). */
async function alreadyThere(dir: FileSystemDirectoryHandle, name: string, size: number) {
  try {
    return (await (await dir.getFileHandle(name)).getFile()).size === size;
  } catch {
    return false;
  }
}

/** Salin foto, tanda tangan, dan lampiran R2 yang belum ada di folder tujuan (yang lama tidak diunduh ulang). */
async function writeFiles(root: FileSystemDirectoryHandle, onProgress: (progress: Progress) => void) {
  const files: { key: string; size: number }[] = [];
  let cursor: string | undefined;
  do {
    const page = await api<{ files: { key: string; size: number }[]; cursor: string | null }>(`files${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
    files.push(...page.files);
    cursor = page.cursor ?? undefined;
  } while (cursor);
  const filesDir = await root.getDirectoryHandle("berkas", { create: true });
  let done = 0;
  let added = 0;
  const queue = [...files];
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const parts = item.key.split("/");
      let dir = filesDir;
      for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true });
      const name = parts[parts.length - 1];
      if (!(await alreadyThere(dir, name, item.size))) {
        const response = await fetch(`${API}/file?key=${encodeURIComponent(item.key)}`, { cache: "no-store" });
        if (response.ok) {
          const out = await (await dir.getFileHandle(name, { create: true }) as FileHandleW).createWritable();
          await out.write(await response.blob());
          await out.close();
          added += 1;
        }
      }
      done += 1;
      onProgress({ phase: "Foto, tanda tangan & lampiran", done, total: files.length });
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return { photos: files.length, newPhotos: added };
}

const record = (body: { folder: string; tables: number; rows: number; photos: number; newPhotos: number }) =>
  api<{ ok: boolean }>("record", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

/** Backup lengkap ke folder pilihan: database/backup-TANGGAL.sql + berkas/ (hanya yang baru). */
export async function backupToFolder(handle: DirHandle, onProgress: (progress: Progress) => void) {
  if (!(await ensurePermission(handle))) throw new Error("Izin menulis ke folder belum diberikan");
  const databaseDir = await handle.getDirectoryHandle("database", { create: true });
  const fileName = `backup-${stamp()}.sql`;
  const file = await (await databaseDir.getFileHandle(fileName, { create: true }) as FileHandleW).createWritable();
  let database;
  try {
    database = await writeDatabase((text) => file.write(text), onProgress);
  } finally {
    await file.close();
  }
  const files = await writeFiles(handle, onProgress);
  await record({ folder: handle.name, ...database, ...files });
  return { fileName, ...database, ...files };
}

/** Cadangan bila browser tidak bisa memilih folder (mis. HP): unduh berkas database saja. */
export async function downloadDatabase(onProgress: (progress: Progress) => void) {
  const parts: string[] = [];
  const database = await writeDatabase(async (text) => { parts.push(text); }, onProgress);
  const url = URL.createObjectURL(new Blob(parts, { type: "application/sql" }));
  const fileName = `backup-${stamp()}.sql`;
  Object.assign(document.createElement("a"), { href: url, download: fileName }).click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  await record({ folder: "unduhan (tanpa foto)", ...database, photos: 0, newPhotos: 0 });
  return { fileName, ...database };
}
