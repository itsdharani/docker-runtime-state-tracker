import { NextRequest, NextResponse } from "next/server";
import neo4j from "neo4j-driver";
import { getNeo4jDriver } from "@/lib/neo4j";

const queryByKind: Record<string, string> = {
  direct: `MATCH (s:Service {name: $name})-[:DEPENDS_ON]->(d:Service)
           RETURN d.name AS service, null AS distance ORDER BY service`,
  dependents: `MATCH (s:Service {name: $name})<-[:DEPENDS_ON]-(d:Service)
               RETURN d.name AS service, null AS distance ORDER BY service`,
  transitive: `MATCH (s:Service {name: $name})-[:DEPENDS_ON*1..]->(d:Service)
               WHERE d <> s
               RETURN DISTINCT d.name AS service, null AS distance ORDER BY service`,
  impact: `MATCH p=(s:Service {name: $name})<-[:DEPENDS_ON*1..]-(d:Service)
           WHERE d <> s
           RETURN d.name AS service, min(length(p)) AS distance ORDER BY distance, service`,
};

export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind") || "direct";
  const name = request.nextUrl.searchParams.get("service") || "";
  const query = queryByKind[kind];
  if (!query || !name) {
    return NextResponse.json({ error: "Provide a service and a supported kind" }, { status: 400 });
  }
  let session;
  try {
    session = getNeo4jDriver().session();
    const result = await session.run(query, { name });
    return NextResponse.json({
      service: name,
      kind,
      results: result.records.map((record) => {
        const value = record.get("distance");
        return {
          service: record.get("service") as string,
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
