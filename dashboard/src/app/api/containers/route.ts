import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT *
      FROM current_container_status
      ORDER BY service_name, container_name;
    `);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("PostgreSQL error:", error);

    return NextResponse.json(
      { error: "Failed to fetch container status" },
      { status: 500 }
    );
  }
}
