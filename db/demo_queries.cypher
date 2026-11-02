// Docker Runtime Tracker Cypher demonstrations.
// Discovery is authoritative: every service/container below comes from synced data.
// Set $service_id to an existing Service.service_id for parameterized examples.

// 01. All discovered services, including independent services.
MATCH (s:Service) RETURN s ORDER BY s.project, s.name;

// 02. All discovered container instances and runtime status.
MATCH (c:Container) RETURN c ORDER BY c.name;

// 03. Declared service dependencies.
MATCH (a:Service)-[r:DEPENDS_ON]->(b:Service)
RETURN a.project, a.name, r.condition, b.name ORDER BY a.project, a.name, b.name;

// 04. Container-to-service membership.
MATCH (c:Container)-[:INSTANCE_OF]->(s:Service)
RETURN c.name, c.container_id, c.status, s.project, s.name ORDER BY s.project, s.name;

// 05. Direct dependencies.
MATCH (s:Service {service_id: $service_id})-[r:DEPENDS_ON]->(d:Service)
RETURN d, r.condition ORDER BY d.name;

// 06. Direct dependents.
MATCH (s:Service {service_id: $service_id})<-[:DEPENDS_ON]-(d:Service)
RETURN d ORDER BY d.name;

// 07. Transitive dependencies: services required by the selected service.
MATCH (s:Service {service_id: $service_id})-[:DEPENDS_ON*1..]->(d:Service)
WHERE d <> s RETURN DISTINCT d ORDER BY d.name;

// 08. Transitive dependents / potential downstream impact with shortest distance.
MATCH p=(s:Service {service_id: $service_id})<-[:DEPENDS_ON*1..]-(d:Service)
WHERE d <> s RETURN d.name AS affected_service, min(length(p)) AS distance
ORDER BY distance, affected_service;

// 09. Independent services have no declared outgoing dependencies.
MATCH (s:Service) WHERE NOT (s)-[:DEPENDS_ON]->()
RETURN s.project, s.name ORDER BY s.project, s.name;

// 10. Services with multiple direct dependents.
MATCH (s:Service)<-[:DEPENDS_ON]-(dependent:Service)
WITH s, count(DISTINCT dependent) AS dependent_count
WHERE dependent_count > 1 RETURN s.project, s.name, dependent_count
ORDER BY dependent_count DESC, s.name;

// 11. Dependency chains from the selected service with path distance.
MATCH p=(s:Service {service_id: $service_id})-[:DEPENDS_ON*1..]->(d:Service)
RETURN [node IN nodes(p) | node.name] AS chain, length(p) AS distance
ORDER BY distance, chain;

// 12. Shortest declared dependency path between any selected endpoints.
MATCH (a:Service {service_id: $from_service_id}),
      (b:Service {service_id: $to_service_id})
MATCH p=shortestPath((a)-[:DEPENDS_ON*..]->(b))
RETURN [node IN nodes(p) | node.name] AS path, length(p) AS distance;

// 13. Enforce stable IDs used by the collector's MERGE operations.
CREATE CONSTRAINT service_id_unique IF NOT EXISTS
FOR (s:Service) REQUIRE s.service_id IS UNIQUE;
CREATE CONSTRAINT container_id_unique IF NOT EXISTS
FOR (c:Container) REQUIRE c.container_id IS UNIQUE;

// 14. Supporting index for project-filtered service inspection.
CREATE INDEX service_project IF NOT EXISTS FOR (s:Service) ON (s.project);

// 15. Safe property update on an existing discovered node (supply its real ID).
MATCH (s:Service {service_id: $service_id})
SET s.reviewed_at = datetime() RETURN s;

// 16. Safe obsolete-edge removal: delete only the matching declared edge.
MATCH (a:Service {service_id: $dependent_id})-[r:DEPENDS_ON]->
      (b:Service {service_id: $required_id})
DELETE r RETURN a.name, b.name;
