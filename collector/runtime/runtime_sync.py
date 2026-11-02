"""Reconcile Docker's current containers with PostgreSQL and Neo4j."""
from collector.database.container_store import get_or_create_container


def synchronize_existing_containers(client, connection, runtime):
    containers = client.containers.list(all=True)
    active_ids = [container.id for container in containers]
    for container in containers:
        _synchronize_one(container, connection, runtime)
    _mark_missing(connection, active_ids)
    if runtime.graph:
        try:
            runtime.graph.mark_missing_removed(active_ids)
        except Exception as error:
            runtime.close()
            print("WARNING: Neo4j removal reconciliation failed:", error)


def _synchronize_one(container, connection, runtime):
    image = container.image.tags[0] if container.image.tags else container.image.short_id
    state = _runtime_state(container.status)
    with connection.cursor() as cursor:
        get_or_create_container(cursor, container.id, container.name, image, container.labels)
        cursor.execute(
            "UPDATE container_status SET current_state=%s,last_updated=CURRENT_TIMESTAMP "
            "WHERE container_id=%s",
            (state, container.id),
        )
    connection.commit()
    if runtime.graph:
        _sync_graph(runtime, container, image, state)


def _runtime_state(status):
    states = {"created", "running", "paused", "restarting", "stopped", "dead", "removed"}
    normalized = {"exited": "stopped", "removing": "stopped"}.get(status, status)
    return normalized if normalized in states else "unknown"


def _sync_graph(runtime, container, image, state):
    try:
        runtime.connect().upsert_container(
            container_id=container.id, name=container.name, image=image,
            status=state, labels=container.labels,
        )
    except Exception as error:
        runtime.close()
        print("WARNING: Neo4j container reconciliation failed:", error)


def _mark_missing(connection, active_ids):
    with connection.cursor() as cursor:
        cursor.execute(
            "UPDATE container_status SET current_state='removed',last_updated=CURRENT_TIMESTAMP "
            "WHERE current_state <> 'removed' AND NOT (container_id = ANY(%s))",
            (active_ids,),
        )
    connection.commit()
