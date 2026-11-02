import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = params.get("q")?.trim() || "";
  const type = params.get("type") || "all";
  const container = params.get("container")?.trim() || "";
  const page = Number(params.get("page") || 1);
  const sort = params.get("sort") === "oldest" ? "ASC" : "DESC";
  if (query.length > 120 || container.length > 120 || type.length > 80 || !Number.isInteger(page) || page < 1 || page > 10000) {
    return NextResponse.json({ error: "Invalid event filters" }, { status: 400 });
  }
  try {
    const result = await pool.query(`
      SELECT c.container_id, c.name AS container_name, s.name AS service_name,
        s.compose_project, e.event_type, e.event_time, count(*) OVER() AS total_count
      FROM container_event e JOIN container c USING (container_id)
      JOIN service s USING (service_id)
      WHERE ($1 = '' OR c.name ILIKE '%' || $1 || '%' OR s.name ILIKE '%' || $1 || '%' OR c.container_id ILIKE '%' || $1 || '%')
        AND ($2 = '' OR c.name ILIKE '%' || $2 || '%' OR c.container_id = $2)
        AND ($3 = 'all' OR e.event_type = $3)
      ORDER BY e.event_time ${sort}, e.event_id ${sort}
      LIMIT 50 OFFSET $4;
    `, [query, container, type, (page - 1) * 50]);

    return NextResponse.json({ rows: result.rows, total: Number(result.rows[0]?.total_count || 0), page, page_size: 50 });
  } catch (error) {
    console.error("PostgreSQL error:", error);

    return NextResponse.json(
      { error: "Failed to fetch event history" },
      { status: 500 }
    );
  }
}
