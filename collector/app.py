"""Entry point for Docker runtime collection."""
import docker

from collector.config.db_connection import connect_postgres
from collector.events.event_listener import listen_for_events
from collector.graph.graph_sync import synchronize_dependency_graph
from collector.graph.runtime_service import RuntimeService
from collector.runtime.runtime_sync import synchronize_existing_containers


def main():
    client = docker.from_env()
    connection = connect_postgres()
    runtime = RuntimeService()
    print("Docker Runtime Tracker")
    print("Connected to Docker and PostgreSQL")
    _connect_graph(runtime)
    _sync_dependencies(connection)
    synchronize_existing_containers(client, connection, runtime)
    try:
        listen_for_events(client, connection, runtime)
    finally:
        connection.close()
        client.close()
        runtime.close()


def _connect_graph(runtime):
    try:
        runtime.connect()
    except Exception as error:
        runtime.close()
        print("WARNING: Neo4j runtime tracking unavailable:", error)


def _sync_dependencies(connection):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT project_name, compose_file FROM compose_source")
            registered = cursor.fetchall()
        synchronize_dependency_graph(registered_sources=registered)
        print("Synchronized Compose dependencies to Neo4j")
    except Exception as error:
        print("WARNING: Neo4j dependency synchronization failed:", error)


if __name__ == "__main__":
    main()
