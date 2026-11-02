import { NextRequest, NextResponse } from "next/server";

async function validSession(token: string | undefined) {
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret || secret.length < 32) return null;
  try {
    const [payload, signature] = token.split(".");
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const bytes = (value: string) => Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0));
    if (!await crypto.subtle.verify("HMAC", key, bytes(signature), new TextEncoder().encode(payload))) return null;
    const user = JSON.parse(atob(payload.replaceAll("-", "+").replaceAll("_", "/")));
    return user.expires > Date.now() ? user : null;
  } catch { return null; }
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/login" || path.startsWith("/api/auth/")) return NextResponse.next();
  const user = await validSession(request.cookies.get("runtime_session")?.value);
  if (!user) return path.startsWith("/api/") ? NextResponse.json({ error: "Authentication required" }, { status: 401 }) : NextResponse.redirect(new URL("/login", request.url));
  if (path.startsWith("/users") && user.role !== "ADMIN") return NextResponse.redirect(new URL("/", request.url));
  if (path.startsWith("/api/admin/") && user.role !== "ADMIN") return NextResponse.json({ error: "Administrator role required" }, { status: 403 });
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
