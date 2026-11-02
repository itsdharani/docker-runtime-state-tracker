import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { currentAdmin, hashPassword } from "@/lib/auth";

export async function GET() {
  if (!await currentAdmin()) return NextResponse.json({ error: "Administrator role required" }, { status: 403 });
  const result = await pool.query("SELECT user_id, username, role FROM app_user ORDER BY username");
  return NextResponse.json(result.rows);
}

export async function POST(request: NextRequest) {
  if (!await currentAdmin()) return NextResponse.json({ error: "Administrator role required" }, { status: 403 });
  try {
    const body = await request.json();
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = body.role === "ADMIN" ? "ADMIN" : body.role === "VIEWER" ? "VIEWER" : "";
    if (!/^[a-zA-Z0-9_.-]{3,100}$/.test(username) || password.length < 12 || password.length > 1024 || !role) return NextResponse.json({ error: "Use a valid username, role, and password of at least 12 characters" }, { status: 400 });
    const result = await pool.query("INSERT INTO app_user (username, password_hash, role) VALUES ($1,$2,$3) RETURNING user_id, username, role", [username, hashPassword(password), role]);
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("User creation failed:", error);
    return NextResponse.json({ error: "Could not create user" }, { status: 409 });
  }
}
