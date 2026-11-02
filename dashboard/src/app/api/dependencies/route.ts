import { NextResponse } from "next/server";
import { getNeo4jDriver } from "@/lib/neo4j";

export const dynamic = "force-dynamic";

export async function GET() {
  let session;
  try {
    session = getNeo4jDriver().session();
    const result = await session.run(`
      MATCH (s:Service)
      WHERE coalesce(s.discovered, true)
      OPTIONAL MATCH (s)-[r:DEPENDS_ON]->(target:Service)
      OPTIONAL MATCH (container:Container)-[:INSTANCE_OF]->(s)
      RETURN s.service_id AS id, s.name AS name, s.project AS project,
             s.compose_file AS source,
             s.dependency_status AS discovery_status,
             s.dependency_error AS discovery_error,
             collect(DISTINCT CASE WHEN target IS NULL THEN null ELSE {
               id: target.service_id, name: target.name,
               condition: r.condition
             } END) AS dependencies,
             collect(DISTINCT CASE WHEN container IS NULL THEN null ELSE {
               name: container.name, status: container.status,
               id: container.container_id
             } END) AS containers
      ORDER BY name
    `);
    const services = result.records.map((record) => ({
      id: record.get("id") as string,
      name: record.get("name") as string,
      project: record.get("project") as string,
      source: record.get("source") as string | null,
      discovery_status: record.get("discovery_status") as string | null,
      discovery_error: record.get("discovery_error") as string | null,
      dependencies: (record.get("dependencies") as Array<{
        id: string; name: string; condition: string;
      } | null>).filter((item) => item !== null),
      containers: (record.get("containers") as Array<{name: string; status: string; id: string} | null>).filter((item) => item !== null),
    }));
    return NextResponse.json({ services });
  } catch (error) {
    console.error("Neo4j error:", error);
    return NextResponse.json({ error: "Failed to fetch dependency graph" }, { status: 503 });
  } finally {
    await session?.close();
  }
}
