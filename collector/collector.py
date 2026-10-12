import docker
import psycopg
import os
from datetime import datetime
from graph_sync import synchronize_dependency_graph
from runtime_graph import RuntimeGraph, event_state
from neo4j import GraphDatabase
from neo4j_config import create_neo4j_driver
from datetime import timezone


POSTGRES_CONFIG = {
    "host": os.getenv("PGHOST", "127.0.0.1"),
    "port": int(os.getenv("PGPORT", "5432")),
    "dbname": os.getenv("PGDATABASE", "runtime_tracker"),
    "user": os.getenv("PGUSER", "tracker"),
    "password": os.getenv("PGPASSWORD"),
}



docker_client = docker.from_env()

pg_connection = psycopg.connect(**POSTGRES_CONFIG)
neo4j_driver = None
runtime_graph = None


def connect_runtime_graph():
    global neo4j_driver, runtime_graph
    if runtime_graph:
        return runtime_graph
    try:
        neo4j_driver = create_neo4j_driver(GraphDatabase.driver)
        neo4j_driver.verify_connectivity()
        runtime_graph = RuntimeGraph(neo4j_driver, os.getenv("GRAPH_PROJECT_NAME", "runtime-tracker"))
        runtime_graph.ensure_schema()
        return runtime_graph
    except Exception:
        if neo4j_driver:
            neo4j_driver.close()
        neo4j_driver = None
        runtime_graph = None
        raise


def forget_runtime_graph():
    global neo4j_driver, runtime_graph
    runtime_graph = None
    if neo4j_driver:
        neo4j_driver.close()
        neo4j_driver = None



def get_or_create_service(
    cursor,
    service_name,
    image,
    compose_project=None,
    compose_file=None,
):
    """
    Find a service by name.

    If it doesn't exist, create it.

    Returns:
        service_id
    """

    cursor.execute(
        """
        SELECT service_id
        FROM service
        WHERE name = %s
        """,
        (service_name,),
    )

    result = cursor.fetchone()

    if result:
        return result[0]

    cursor.execute(
        """
        INSERT INTO service (
            name,
            image,
            compose_file
        )
        VALUES (%s, %s, %s)
        RETURNING service_id
        """,
        (
            service_name,
            image,
            compose_file,
        ),
    )

    return cursor.fetchone()[0]



def get_or_create_container(
    cursor,
    container_id,
    container_name,
    image,
    labels,
):
    """
    Make sure the container exists in PostgreSQL.

    Returns:
        service_id
    """


    compose_service = labels.get(
        "com.docker.compose.service"
    )

    compose_project = labels.get(
        "com.docker.compose.project"
    )

    compose_config = labels.get(
        "com.docker.compose.project.config_files"
    )


    if compose_service:
        service_name = compose_service
    else:
        service_name = container_name

    # Find/create service

    service_id = get_or_create_service(
        cursor=cursor,
        service_name=service_name,
        image=image,
        compose_project=compose_project,
        compose_file=compose_config,
    )

    # Check whether container already exists

    cursor.execute(
        """
        SELECT container_id
        FROM container
        WHERE container_id = %s
        """,
        (container_id,),
    )

    existing = cursor.fetchone()

    if existing:
        return service_id

    # Insert container

    cursor.execute(
        """
        INSERT INTO container (
            container_id,
            service_id,
            name,
            image
        )
        VALUES (%s, %s, %s, %s)
        """,
        (
            container_id,
            service_id,
            container_name,
            image,
        ),
    )

    # Create initial status

    cursor.execute(
        """
        INSERT INTO container_status (
            container_id,
            current_state,
            last_event_type
        )
        VALUES (%s, %s, %s)
        ON CONFLICT (container_id) DO NOTHING
        """,
        (
            container_id,
            "unknown",
            None,
        ),
    )

    return service_id


# STORE EVENT

def store_event(event):
    """
    Store the structured event information in PostgreSQL.
    """

    event_type = event.get("Type")


    if event_type != "container":
        return

    action = event.get("Action")

    actor = event.get("Actor", {})

    container_id = actor.get("ID")

    attributes = actor.get("Attributes", {})

    container_name = attributes.get(
        "name",
        "unknown",
    )

    image = attributes.get(
        "image",
        "unknown",
    )

    event_epoch = event.get("timeNano", event.get("time"))
    if "timeNano" in event:
        event_epoch = event_epoch / 1_000_000_000
    event_timestamp = datetime.fromtimestamp(event_epoch, tz=timezone.utc)
    state = event_state(action)

    with pg_connection.cursor() as cursor:


        try:
            docker_container = docker_client.containers.get(
                container_id
            )

            labels = docker_container.labels

        except docker.errors.NotFound:
            labels = {}


        get_or_create_container(
            cursor=cursor,
            container_id=container_id,
            container_name=container_name,
            image=image,
            labels=labels,
        )

        # Store event

        cursor.execute(
            """
            INSERT INTO container_event (
                container_id,
                event_type,
                event_time
            )
            VALUES (%s, %s, %s)
            """,
            (
                container_id,
                action,
                event_timestamp.replace(tzinfo=None),
            ),
        )

        if state == "removed":
            cursor.execute(
                "UPDATE container_status SET current_state = 'stopped', last_event_type = %s, last_updated = %s WHERE container_id = %s",
                (action, event_timestamp.replace(tzinfo=None), container_id),
            )

    pg_connection.commit()
    try:
        connect_runtime_graph().upsert_container(
            container_id=container_id, name=container_name, image=image,
            status=state if state != "unknown" else None,
            labels=labels, updated_at=event_timestamp.isoformat(),
        )
    except Exception as error:
        forget_runtime_graph()
        print("WARNING: Neo4j runtime update failed; event remains in PostgreSQL and will be reconciled:", error)


# INITIAL SYNCHRONIZATION

def synchronize_existing_containers():
    """
    Find all existing Docker containers and make sure
    PostgreSQL knows about them.

    This handles containers that existed before the
    collector was started.
    """

    print("Synchronizing existing containers...")

    containers = docker_client.containers.list(
        all=True
    )
    active_container_ids = [container.id for container in containers]

    for container in containers:

        container_id = container.id

        container_name = container.name

        image = (
            container.image.tags[0]
            if container.image.tags
            else container.image.short_id
        )

        labels = container.labels

        with pg_connection.cursor() as cursor:

            get_or_create_container(
                cursor=cursor,
                container_id=container_id,
                container_name=container_name,
                image=image,
                labels=labels,
            )

            # Set current state based on Docker

            docker_status = container.status

            if docker_status == "running":
                current_state = "running"

            elif docker_status == "created":
                current_state = "created"

            elif docker_status == "paused":
                current_state = "paused"

            elif docker_status == "restarting":
                current_state = "restarting"

            elif docker_status == "exited":
                current_state = "stopped"

            elif docker_status == "dead":
                current_state = "dead"

            else:
                current_state = docker_status

            cursor.execute(
                """
                UPDATE container_status
                SET
                    current_state = %s,
                    last_updated = CURRENT_TIMESTAMP
                WHERE container_id = %s
                """,
                (
                    current_state,
                    container_id,
                ),
            )

        pg_connection.commit()
        if runtime_graph:
            runtime_graph.upsert_container(
                container_id=container_id, name=container_name, image=image,
                status=current_state, labels=labels,
            )

        print(f"SYNC: {container_name} | {current_state}")

    with pg_connection.cursor() as cursor:
        cursor.execute(
            "UPDATE container_status SET current_state = 'stopped', last_updated = CURRENT_TIMESTAMP "
            "WHERE current_state IN ('running', 'restarting', 'paused', 'created') "
            "AND NOT (container_id = ANY(%s))",
            (active_container_ids,),
        )
    pg_connection.commit()
    print("Initial synchronization complete.")
    if runtime_graph:
        runtime_graph.mark_missing_removed(active_container_ids)


# EVENT LISTENER

def listen_for_events():

    print("Listening for Docker events...")

    for event in docker_client.events(
        decode=True
    ):

        try:

            event_type = event.get("Type")

            action = event.get("Action")

            if event_type == "container":

                actor = event.get(
                    "Actor",
                    {},
                )

                attributes = actor.get(
                    "Attributes",
                    {},
                )

                container_name = attributes.get(
                    "name",
                    "unknown",
                )

                container_id = actor.get(
                    "ID",
                    "unknown",
                )

                print(
                    f"EVENT: {action} | "
                    f"{container_name} | "
                    f"{container_id[:12]}"
                )

                store_event(event)

            else:

                print(
                    f"IGNORED: "
                    f"{event_type} | "
                    f"{action}"
                )

        except Exception as error:

            print(
                "ERROR processing event:",
                error,
            )

            pg_connection.rollback()


def main():

    print(" Docker Runtime Tracker")
    print("Connected to Docker")
    print("Connected to PostgreSQL")
    try:
        connect_runtime_graph()
    except Exception as error:
        forget_runtime_graph()
        print("WARNING: Neo4j runtime tracking unavailable:", error)
    try:
        synchronize_dependency_graph()
        print("Synchronized declared Compose dependencies to Neo4j")
    except Exception as error:
        print("WARNING: Neo4j dependency synchronization failed:", error)
    synchronize_existing_containers()
    try:
        listen_for_events()
    finally:
        pg_connection.close()
        docker_client.close()
        if neo4j_driver:
            neo4j_driver.close()


if __name__ == "__main__":
    main()
