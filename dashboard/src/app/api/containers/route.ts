import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";
  const state = request.nextUrl.searchParams.get("state") || "all";
  const page = Number(request.nextUrl.searchParams.get("page") || 1);
  if (query.length > 120 || !Number.isInteger(page) || page < 1 || page > 10000 ||
      !["all", "running", "stopped", "created", "paused", "restarting", "dead", "removed", "unknown"].includes(state)) {
    return NextResponse.json({ error: "Invalid container filters" }, { status: 400 });
  }
  try {
    const result = await pool.query(`
      SELECT *, count(*) OVER() AS total_count
      FROM current_container_status
      WHERE ($1 = '' OR container_name ILIKE '%' || $1 || '%' OR container_id ILIKE '%' || $1 || '%' OR service_name ILIKE '%' || $1 || '%' OR compose_project ILIKE '%' || $1 || '%')
        AND ($2 = 'all' OR current_state = $2)
      ORDER BY last_updated DESC, container_name
      LIMIT 50 OFFSET $3;
    `, [query, state, (page - 1) * 50]);

    return NextResponse.json({ rows: result.rows, total: Number(result.rows[0]?.total_count || 0), page, page_size: 50 });
  } catch (error) {
    console.error("PostgreSQL error:", error);

    return NextResponse.json(
      { error: "Failed to fetch container status" },
      { status: 500 }
    );
  }
}
