import { z } from "zod";

/**
 * Username: 2–64 karakter, diawali & diakhiri huruf/angka (huruf kecil),
 * boleh memakai titik (.), garis bawah (_), atau tanda hubung (-), tanpa titik berurutan.
 */
const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])$/;

export function normalizeLoginId(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

export function isValidUsername(value: string): boolean {
  return USERNAME_RE.test(value) && !value.includes("..");
}

export function isValidEmail(value: string): boolean {
  return z.email().safeParse(value).success;
}

/** Validasi identitas login kantor: boleh berupa alamat email maupun username. */
export function isValidLoginId(raw: string): boolean {
  const value = normalizeLoginId(raw);
  if (!value) return false;
  return value.includes("@") ? isValidEmail(value) : isValidUsername(value);
}

export const LoginIdSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine(isValidLoginId, "Masukkan email atau username yang valid (minimal 2 karakter; huruf, angka, titik, _, atau -).");

/** Escape wildcard SQLite LIKE (% dan _ serta \). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}
