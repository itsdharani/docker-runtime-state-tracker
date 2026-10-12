import docker
import psycopg
import os
from datetime import datetime
from graph_sync import synchronize_dependency_graph


POSTGRES_CONFIG = {
    "host": os.getenv("PGHOST", "127.0.0.1"),
    "port": int(os.getenv("PGPORT", "5432")),
    "dbname": os.getenv("PGDATABASE", "runtime_tracker"),
    "user": os.getenv("PGUSER", "tracker"),
    "password": os.getenv("PGPASSWORD"),
}



docker_client = docker.from_env()

pg_connection = psycopg.connect(**POSTGRES_CONFIG)



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

    # Docker timestamp

    event_timestamp = datetime.fromtimestamp(event["time"])

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
                event_timestamp,
            ),
        )

    pg_connection.commit()


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

        print(
            f"SYNC: {container_name} | "
            f"{current_state}"
        )

    print("Initial synchronization complete.")


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
    synchronize_existing_containers()
    try:
        synchronize_dependency_graph()
        print("Synchronized declared Compose dependencies to Neo4j")
    except Exception as error:
        print("WARNING: Neo4j dependency synchronization failed:", error)
    try:
        listen_for_events()
    finally:
        pg_connection.close()
        docker_client.close()


if __name__ == "__main__":
    main()
