import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { currentAdmin } from "@/lib/auth";

type Context = { params: Promise<{ id: string }> };
async function accountId(context: Context) {
  const { id } = await context.params;
  return /^\d+$/.test(id) && Number(id) > 0 ? Number(id) : null;
}

export async function PATCH(request: NextRequest, context: Context) {
  const admin = await currentAdmin(); const id = await accountId(context);
  if (!admin) return NextResponse.json({ error: "Administrator role required" }, { status: 403 });
  if (!id) return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  try {
    const { role } = await request.json();
    if (!["ADMIN", "VIEWER"].includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    const target = await pool.query("SELECT username,role FROM app_user WHERE user_id=$1", [id]);
    if (!target.rowCount) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (admin.username === target.rows[0].username) return NextResponse.json({ error: "You cannot change your own role" }, { status: 400 });
    if (target.rows[0].role === "ADMIN" && role === "VIEWER" && !await _hasOtherAdmin(id)) return NextResponse.json({ error: "At least one administrator must remain" }, { status: 409 });
    const result = await pool.query("UPDATE app_user SET role=$1 WHERE user_id=$2 RETURNING user_id,username,role", [role, id]);
    return result.rowCount ? NextResponse.json(result.rows[0]) : NextResponse.json({ error: "User not found" }, { status: 404 });
  } catch { return NextResponse.json({ error: "Could not update user" }, { status: 500 }); }
}

export async function DELETE(_request: NextRequest, context: Context) {
  const admin = await currentAdmin(); const id = await accountId(context);
  if (!admin) return NextResponse.json({ error: "Administrator role required" }, { status: 403 });
  if (!id) return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  try {
    const target = await pool.query("SELECT username,role FROM app_user WHERE user_id=$1", [id]);
    if (!target.rowCount) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (target.rows[0].username === admin.username) return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
    if (target.rows[0].role === "ADMIN" && !await _hasOtherAdmin(id)) return NextResponse.json({ error: "At least one administrator must remain" }, { status: 409 });
    await pool.query("DELETE FROM app_user WHERE user_id=$1", [id]);
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Could not remove user" }, { status: 500 }); }
}

async function _hasOtherAdmin(id: number) {
  const result = await pool.query("SELECT count(*) AS count FROM app_user WHERE role='ADMIN' AND user_id<>$1", [id]);
  return Number(result.rows[0].count) > 0;
}
