import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export type User = { username: string; role: "ADMIN" | "VIEWER"; expires: number };
const cookieName = "runtime_session";
function secret() { const value = process.env.AUTH_SECRET; if (!value || value.length < 32) throw new Error("AUTH_SECRET must contain at least 32 characters"); return value; }
function sign(payload: string) { return createHmac("sha256", secret()).update(payload).digest("base64url"); }
export function createSession(username: string, role: User["role"]) { const payload = Buffer.from(JSON.stringify({ username, role, expires: Date.now() + 3 * 86400000 })).toString("base64url"); return `${payload}.${sign(payload)}`; }
export function readSession(token: string | undefined): User | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload)); const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try { const user = JSON.parse(Buffer.from(payload, "base64url").toString()) as User; return user.expires > Date.now() ? user : null; } catch { return null; }
}
export function hashPassword(password: string) { const salt = randomBytes(16).toString("hex"); return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`; }
export function verifyPassword(password: string, encoded: string) {
  const [salt, hash] = encoded.split(":"); if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 64); const expected = Buffer.from(hash, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
export async function currentUser() { return readSession((await cookies()).get(cookieName)?.value); }
export const sessionCookie = { name: cookieName, options: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 3 * 86400 } };
