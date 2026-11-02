"""Idempotent Neo4j synchronization for Docker container instances."""


def event_state(action):
    return {
        "create": "created", "start": "running", "restart": "running",
        "stop": "stopped", "die": "dead", "kill": "dead",
        "pause": "paused", "unpause": "running", "destroy": "removed",
        "oom": "dead",
    }.get(action, "unknown")


class RuntimeGraph:
    def __init__(self, driver, graph_project="runtime-tracker"):
        self.driver = driver
        self.graph_project = graph_project

    def ensure_schema(self):
        with self.driver.session() as session:
            session.run(
                "CREATE CONSTRAINT container_id_unique IF NOT EXISTS "
                "FOR (c:Container) REQUIRE c.container_id IS UNIQUE"
            ).consume()

    def mark_missing_removed(self, active_container_ids):
        with self.driver.session() as session:
            session.run(
                "MATCH (c:Container) WHERE NOT c.container_id IN $active_ids "
                "AND c.status <> 'removed' "
                "SET c.status = 'removed', c.updated_at = datetime()",
                active_ids=active_container_ids,
            ).consume()

    def upsert_container(self, *, container_id, name, image, status,
                         labels=None, updated_at=None):
        labels = labels or {}
        compose_service = labels.get("com.docker.compose.service")
        compose_project = labels.get("com.docker.compose.project")
        # graph_sync owns these namespaced service IDs. The configured project
        # is stable even if Compose's runtime project name differs.
        project = compose_project or self.graph_project
        service_id = f"{project}:{compose_service}" if compose_service else None
        with self.driver.session() as session:
            session.run(
                "MERGE (c:Container {container_id: $id}) "
                "ON CREATE SET c.discovered_at = coalesce(datetime($updated_at), datetime()), "
                "c.status = coalesce($status, 'unknown') "
                "WITH c, CASE WHEN $updated_at IS NULL OR c.updated_at IS NULL "
                "OR datetime($updated_at) >= c.updated_at THEN true ELSE false END AS newer "
                "SET c.name = $name, c.image = $image, "
                "c.status = CASE WHEN newer AND $status IS NOT NULL THEN $status ELSE c.status END, "
                "c.updated_at = CASE WHEN newer THEN coalesce(datetime($updated_at), datetime()) ELSE c.updated_at END, "
                "c.compose_service = coalesce($compose_service, c.compose_service), "
                "c.compose_project = coalesce($compose_project, c.compose_project)",
                id=container_id, name=name, image=image, status=status,
                updated_at=updated_at, compose_service=compose_service,
                compose_project=compose_project,
            ).consume()
            if service_id:
                session.run(
                    "MATCH (c:Container {container_id: $id}) "
                    "MATCH (s:Service {service_id: $service_id}) "
                    "MERGE (c)-[:INSTANCE_OF]->(s)",
                    id=container_id, service_id=service_id,
                ).consume()
                session.run(
                    "MATCH (c:Container {container_id: $id})-[r:INSTANCE_OF]->(s:Service) "
                    "WHERE s.service_id <> $service_id DELETE r",
                    id=container_id, service_id=service_id,
                ).consume()

