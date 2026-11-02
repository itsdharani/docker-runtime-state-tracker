"""Create/update PostgreSQL container and current-status records."""
from collector.database.service_store import get_or_create_service


def get_or_create_container(cursor, container_id, name, image, labels):
    """Upsert a container without inferring standalone service membership."""
    labels = labels or {}
    service_name = labels.get("com.docker.compose.service")
    project = labels.get("com.docker.compose.project")
    compose_file = labels.get("com.docker.compose.project.config_files")
    cursor.execute("SELECT service_id FROM container WHERE container_id=%s", (container_id,))
    existing = cursor.fetchone()
    if not service_name and existing:
        cursor.execute(
            "UPDATE container SET name=%s, image=%s WHERE container_id=%s",
            (name, image, container_id),
        )
        return existing[0]
    service_id = get_or_create_service(
        cursor, service_name or name, image, project, compose_file
    )
    if existing:
        cursor.execute(
            "UPDATE container SET service_id=%s, name=%s, image=%s WHERE container_id=%s",
            (service_id, name, image, container_id),
        )
        return service_id
    _insert_container(cursor, container_id, service_id, name, image)
    return service_id


def _insert_container(cursor, container_id, service_id, name, image):
    cursor.execute(
        "INSERT INTO container(container_id,service_id,name,image) VALUES (%s,%s,%s,%s)",
        (container_id, service_id, name, image),
    )
    cursor.execute(
        "INSERT INTO container_status(container_id,current_state) VALUES (%s,'unknown') "
        "ON CONFLICT (container_id) DO NOTHING",
        (container_id,),
    )
