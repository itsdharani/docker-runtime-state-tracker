import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { currentAdmin } from "@/lib/auth";

export async function GET() {
  if (!await currentAdmin()) return NextResponse.json({ error: "Administrator role required" }, { status: 403 });
  const result = await pool.query("SELECT source_id,project_name,compose_file,created_at FROM compose_source ORDER BY project_name,compose_file");
  return NextResponse.json(result.rows);
}

export async function POST(request: NextRequest) {
  if (!await currentAdmin()) return NextResponse.json({ error: "Administrator role required" }, { status: 403 });
  const body = await request.json();
  const project = typeof body.project_name === "string" ? body.project_name.trim() : "";
  const filename = typeof body.compose_file === "string" ? body.compose_file.trim() : "";
  if (!/^[a-zA-Z0-9_.-]{1,255}$/.test(project) || !filename.startsWith("/") || filename.length > 2048) return NextResponse.json({ error: "Enter a project key and absolute Compose path" }, { status: 400 });
  try {
    const result = await pool.query("INSERT INTO compose_source(project_name,compose_file) VALUES($1,$2) RETURNING *", [project, filename]);
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch { return NextResponse.json({ error: "Path is already registered or could not be saved" }, { status: 409 }); }
}

export async function DELETE(request: NextRequest) {
  if (!await currentAdmin()) return NextResponse.json({ error: "Administrator role required" }, { status: 403 });
  const body = await request.json();
  const id = Number(body.source_id);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Invalid source ID" }, { status: 400 });
  const result = await pool.query("DELETE FROM compose_source WHERE source_id=$1 RETURNING source_id", [id]);
  return result.rowCount ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Source not found" }, { status: 404 });
}
