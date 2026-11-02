import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [stats, events] = await Promise.all([
      pool.query(`SELECT count(*) AS total,
        count(*) FILTER (WHERE current_state = 'running') AS running,
        count(*) FILTER (WHERE current_state IN ('stopped', 'removed')) AS stopped,
        count(*) FILTER (WHERE current_state IN ('dead', 'unknown')) AS errors,
        count(DISTINCT service_id) AS services,
        count(DISTINCT compose_project) FILTER (WHERE compose_project <> 'standalone') AS projects
        FROM current_container_status JOIN container USING (container_id)`),
      pool.query(`SELECT container_name, service_name, event_type, event_time
        FROM container_event_history ORDER BY event_time DESC LIMIT 8`),
    ]);
    return NextResponse.json({ ...stats.rows[0], recent_events: events.rows });
  } catch (error) {
    console.error("Overview query failed:", error);
    return NextResponse.json({ error: "Failed to load overview" }, { status: 500 });
  }
}
