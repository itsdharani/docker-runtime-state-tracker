"""Persist lifecycle events and mirror latest state into Neo4j."""
from datetime import datetime, timezone

import docker

from container_store import get_or_create_container
from runtime_graph import event_state


def store_event(event, client, connection, runtime):
    if event.get("Type") != "container":
        return
    actor = event.get("Actor") or {}
    container_id = actor.get("ID")
    if not container_id:
        return
    attrs = actor.get("Attributes") or {}
    name, image = attrs.get("name", "unknown"), attrs.get("image", "unknown")
    labels = _container_labels(client, container_id)
    timestamp = _event_timestamp(event)
    action = event.get("Action", "unknown")
    with connection.cursor() as cursor:
        get_or_create_container(cursor, container_id, name, image, labels)
        cursor.execute(
            "INSERT INTO container_event(container_id,event_type,event_time) VALUES (%s,%s,%s)",
            (container_id, action, timestamp.replace(tzinfo=None)),
        )
    connection.commit()
    _update_graph(runtime, container_id, name, image, action, labels, timestamp)


def _container_labels(client, container_id):
    try:
        return client.containers.get(container_id).labels
    except docker.errors.NotFound:
        return {}


def _event_timestamp(event):
    seconds = event.get("timeNano", event.get("time", 0))
    if "timeNano" in event:
        seconds /= 1_000_000_000
    return datetime.fromtimestamp(seconds, tz=timezone.utc)


def _update_graph(runtime, container_id, name, image, action, labels, timestamp):
    try:
        runtime.connect().upsert_container(
            container_id=container_id, name=name, image=image,
            status=event_state(action), labels=labels,
            updated_at=timestamp.isoformat(),
        )
    except Exception as error:
        runtime.close()
        print("WARNING: Neo4j event update failed; PostgreSQL event was retained:", error)
