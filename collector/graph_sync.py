"""Discover Compose files from Docker labels and synchronize declared edges."""
from compose_discovery import compose_sources, read_project


def synchronize_dependency_graph(client=None):
    from neo4j import GraphDatabase
    from neo4j_config import create_neo4j_driver
    sources = compose_sources(client)
    driver = create_neo4j_driver(GraphDatabase.driver)
    try:
        driver.verify_connectivity()
        with driver.session() as session:
            session.run("CREATE CONSTRAINT service_id_unique IF NOT EXISTS FOR (s:Service) REQUIRE s.service_id IS UNIQUE").consume()
            for (project, _), path in sources.items():
                try:
                    services, edges = read_project(project, path)
                except (OSError, yaml.YAMLError, ValueError) as error:
                    print(f"WARNING: dependencies unavailable for Compose project {project} at {path}: {error}")
                    continue
                sync_project(session, project, path, services, edges)
        print(f"Synchronized {len(sources)} discovered Compose configuration(s)")
    finally:
        driver.close()


def sync_project(session, project, path, services, edges):
    """Idempotently replace a project's services and declared relationships."""
    service_ids = [f"{project}:{name}" for name in services]
    records = [{"id": f"{project}:{name}", "name": name} for name in services]
    session.run("UNWIND $items AS item MERGE (s:Service {service_id:item.id}) SET s.name=item.name, s.project=$project, s.compose_file=$path", items=records, project=project, path=str(path)).consume()
    session.run("MATCH (s:Service {project:$project})-[r:DEPENDS_ON]->() DELETE r", project=project).consume()
    relations = [{"from": f"{project}:{name}", "to": f"{project}:{target}", "condition": condition} for name, target, condition in edges]
    session.run("UNWIND $items AS item MATCH (a:Service {service_id:item.from}) MATCH (b:Service {service_id:item.to}) MERGE (a)-[r:DEPENDS_ON]->(b) SET r.condition=item.condition, r.project=$project", items=relations, project=project).consume()
    session.run("MATCH (s:Service {project:$project}) WHERE NOT s.service_id IN $ids DETACH DELETE s", project=project, ids=service_ids).consume()


if __name__ == "__main__":
    synchronize_dependency_graph()
