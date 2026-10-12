import { NextResponse } from "next/server";
import { getNeo4jDriver } from "@/lib/neo4j";

export const dynamic = "force-dynamic";

export async function GET() {
  let session;
  try {
    session = getNeo4jDriver().session();
    const result = await session.run(`
      MATCH (s:Service)
      OPTIONAL MATCH (s)-[r:DEPENDS_ON]->(target:Service)
      RETURN s.service_id AS id, s.name AS name, s.project AS project,
             collect(CASE WHEN target IS NULL THEN null ELSE {
               id: target.service_id, name: target.name,
               condition: r.condition
             } END) AS dependencies
      ORDER BY name
    `);
    const services = result.records.map((record) => ({
      id: record.get("id") as string,
      name: record.get("name") as string,
      project: record.get("project") as string,
      dependencies: (record.get("dependencies") as Array<{
        id: string; name: string; condition: string;
      } | null>).filter((item) => item !== null),
    }));
    return NextResponse.json({ services });
  } catch (error) {
    console.error("Neo4j error:", error);
    return NextResponse.json({ error: "Failed to fetch dependency graph" }, { status: 503 });
  } finally {
    await session?.close();
  }
}
