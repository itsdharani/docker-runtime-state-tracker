import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[a-f0-9]{12,64}$/i.test(id)) return NextResponse.json({ error: "Invalid container ID" }, { status: 400 });
  try {
    const result = await pool.query(`SELECT c.container_id, c.name AS container_name,
      c.image AS container_image, c.started_at, c.stopped_at, s.name AS service_name,
      s.compose_project, s.compose_file, cs.current_state, cs.restart_count,
      cs.last_updated, e.event_type, e.event_time
      FROM container c JOIN service s USING (service_id)
      JOIN container_status cs USING (container_id)
      LEFT JOIN container_event e USING (container_id)
      WHERE c.container_id = $1 ORDER BY e.event_time DESC LIMIT 201`, [id]);
    if (!result.rowCount) return NextResponse.json({ error: "Container not found" }, { status: 404 });
    const container = Object.fromEntries(Object.entries(result.rows[0]).filter(([key]) => key !== "event_type" && key !== "event_time"));
    return NextResponse.json({ container, events: result.rows.filter(row => row.event_type).map(row => ({ type: row.event_type, time: row.event_time })) });
  } catch (error) {
    console.error("Container detail query failed:", error);
    return NextResponse.json({ error: "Could not load container details" }, { status: 500 });
  }
}
