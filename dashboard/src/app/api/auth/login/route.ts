import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { createSession, sessionCookie, verifyPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || username.length > 100 || !password || password.length > 1024) return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
    const result = await pool.query("SELECT username, password_hash, role FROM app_user WHERE username = $1", [username]);
    const user = result.rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    const response = NextResponse.json({ username: user.username, role: user.role });
    response.cookies.set(sessionCookie.name, createSession(user.username, user.role), sessionCookie.options);
    return response;
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json({ error: "Login is unavailable" }, { status: 503 });
  }
}
