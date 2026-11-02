"""PostgreSQL operations for logical service records."""


def get_or_create_service(cursor, name, image, project=None, compose_file=None):
    """Return a project-scoped service ID, updating its latest metadata."""
    project = project or "standalone"
    cursor.execute(
        """INSERT INTO service(name, compose_project, image, compose_file)
           VALUES (%s, %s, %s, %s)
           ON CONFLICT (compose_project, name) DO UPDATE
           SET image = EXCLUDED.image,
               compose_file = COALESCE(EXCLUDED.compose_file, service.compose_file)
           RETURNING service_id""",
        (name, project, image, compose_file),
    )
    return cursor.fetchone()[0]
