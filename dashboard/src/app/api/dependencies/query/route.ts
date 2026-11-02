import { NextRequest, NextResponse } from "next/server";
import neo4j from "neo4j-driver";
import { getNeo4jDriver } from "@/lib/neo4j";

const queryByKind: Record<string, string> = {
  direct: `MATCH (s:Service {service_id: $id})-[:DEPENDS_ON]->(d:Service)
           RETURN d.service_id AS id, d.name AS service, null AS distance ORDER BY service`,
  dependents: `MATCH (s:Service {service_id: $id})<-[:DEPENDS_ON]-(d:Service)
               RETURN d.service_id AS id, d.name AS service, null AS distance ORDER BY service`,
  transitive: `MATCH (s:Service {service_id: $id})-[:DEPENDS_ON*1..]->(d:Service)
               WHERE d <> s
               RETURN DISTINCT d.service_id AS id, d.name AS service, null AS distance ORDER BY service`,
  impact: `MATCH p=(s:Service {service_id: $id})<-[:DEPENDS_ON*1..]-(d:Service)
           WHERE d <> s
           RETURN d.service_id AS id, d.name AS service, min(length(p)) AS distance ORDER BY distance, service`,
};

export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind") || "direct";
  const id = request.nextUrl.searchParams.get("id") || "";
  const query = queryByKind[kind];
  if (!query || !/^[^\s:]+:[^\s:]+$/.test(id) || id.length > 512) {
    return NextResponse.json({ error: "Provide a valid service ID and a supported kind" }, { status: 400 });
  }
  let session;
  try {
    session = getNeo4jDriver().session();
    const result = await session.run(query, { id });
    return NextResponse.json({
      service_id: id,
      kind,
      results: result.records.map((record) => {
        const value = record.get("distance");
        return {
          service: record.get("service") as string,
          service_id: record.get("id") as string,
          distance: value == null ? null : neo4j.isInt(value) ? value.toNumber() : Number(value),
        };
      }),
    });
  } catch (error) {
    console.error("Neo4j query error:", error);
    return NextResponse.json({ error: "Failed to query dependencies" }, { status: 503 });
  } finally {
    await session?.close();
  }
}
