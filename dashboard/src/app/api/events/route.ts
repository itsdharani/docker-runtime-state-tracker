import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        container_name,
        service_name,
        event_type,
        event_time,
        mongo_ref
      FROM container_event_history
      ORDER BY event_time DESC;
    `);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("PostgreSQL error:", error);

    return NextResponse.json(
      { error: "Failed to fetch event history" },
      { status: 500 }
    );
  }
}
