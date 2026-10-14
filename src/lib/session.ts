import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "ib_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 hari

export type SessionPayload = { sub: string; email: string; name: string; iat?: number };

function key(secret: string) {
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET belum diisi atau kurang dari 32 karakter.");
  return new TextEncoder().encode(secret);
}

export async function signSession(p: Omit<SessionPayload, "iat">, secret: string) {
  return new SignJWT({ email: p.email, name: p.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(p.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(key(secret));
}

export async function verifySession(token: string | undefined, secret: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    return { sub: String(payload.sub), email: String(payload.email), name: String(payload.name), iat: payload.iat };
  } catch {
    return null;
  }
}
