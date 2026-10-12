"""Synchronize declared Docker Compose dependencies into Neo4j."""

import os
from pathlib import Path

import yaml
from neo4j import GraphDatabase
from neo4j_config import create_neo4j_driver


def _dependency_map(compose_path):
    with Path(compose_path).expanduser().resolve().open(encoding="utf-8") as source:
        config = yaml.safe_load(source) or {}
    services = config.get("services") or {}
    dependencies = {}
    for name, definition in services.items():
        declared = definition.get("depends_on") or {}
        if isinstance(declared, list):
            dependencies[name] = {target: "service_started" for target in declared}
        elif isinstance(declared, dict):
            dependencies[name] = {
                target: (options or {}).get("condition", "service_started")
                for target, options in declared.items()
            }
        else:
            raise ValueError(f"Unsupported depends_on declaration for service {name}")
    return dependencies


def synchronize_dependency_graph():
    compose_path = os.getenv("COMPOSE_FILE", "demo/docker-compose.yml")
    project = os.getenv("GRAPH_PROJECT_NAME", "runtime-tracker")
    services = _dependency_map(compose_path)
    service_ids = [f"{project}:{name}" for name in services]
    relationships = [
        {
            "dependent": f"{project}:{name}",
            "required": f"{project}:{target}",
            "condition": condition,
        }
        for name, targets in services.items()
        for target, condition in targets.items()
    ]
    unknown = [
        relation for relation in relationships
        if relation["required"].split(":", 1)[1] not in services
    ]
    if unknown:
        raise ValueError(f"depends_on references an undeclared service: {unknown[0]['required']}")

    driver = create_neo4j_driver(GraphDatabase.driver)
    try:
        driver.verify_connectivity()
        with driver.session() as session:
            session.run(
                "CREATE CONSTRAINT service_id_unique IF NOT EXISTS "
                "FOR (s:Service) REQUIRE s.service_id IS UNIQUE"
            ).consume()
            with session.begin_transaction() as transaction:
                transaction.run(
                    "UNWIND $services AS item "
                    "MERGE (s:Service {service_id: item.id}) "
                    "SET s.name = item.name, s.project = $project",
                    services=[{"id": f"{project}:{name}", "name": name} for name in services],
                    project=project,
                ).consume()
                transaction.run(
                    "MATCH (s:Service {project: $project})-[r:DEPENDS_ON]->() "
                    "DELETE r",
                    project=project,
                ).consume()
                transaction.run(
                    "UNWIND $relationships AS item "
                    "MATCH (dependent:Service {service_id: item.dependent}) "
                    "MATCH (required:Service {service_id: item.required}) "
                    "MERGE (dependent)-[r:DEPENDS_ON]->(required) "
                    "SET r.condition = item.condition, r.project = $project",
                    relationships=relationships,
                    project=project,
                ).consume()
                # Remove service nodes deleted from this project's Compose file.
                transaction.run(
                    "MATCH (s:Service {project: $project}) "
                    "WHERE NOT s.service_id IN $service_ids "
                    "DETACH DELETE s",
                    project=project,
                    service_ids=service_ids,
                ).consume()
    finally:
        driver.close()


if __name__ == "__main__":
    synchronize_dependency_graph()
