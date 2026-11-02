"""Read Compose project sources discovered from Docker labels or settings."""
import os
from pathlib import Path

import yaml


def compose_sources(client=None):
    """Return project/file pairs from running or stopped containers and settings."""
    if client is None:
        import docker
        client = docker.from_env()
    sources = {}
    for container in client.containers.list(all=True):
        labels = container.labels
        project = labels.get("com.docker.compose.project")
        files = labels.get("com.docker.compose.project.config_files", "")
        for filename in files.split(","):
            if project and filename.strip():
                sources[(project, filename.strip())] = Path(filename.strip())
    registered = os.getenv("COMPOSE_PATHS", "")
    entries = registered.split(os.pathsep) if registered else []
    if not entries and os.getenv("COMPOSE_FILE"):
        entries = [f"{os.getenv('GRAPH_PROJECT_NAME', 'runtime-tracker')}={os.getenv('COMPOSE_FILE')}"]
    for entry in entries:
        if not entry.strip():
            continue
        project_name, separator, filename = entry.partition("=")
        path = Path(filename if separator else entry).expanduser()
        project = project_name if separator else (path.parent.name or path.stem)
        sources[(project, str(path))] = path
    return sources


def read_project(project, path):
    """Read service names and declared dependencies from one Compose file."""
    with path.resolve().open(encoding="utf-8") as source:
        config = yaml.safe_load(source) or {}
    services = config.get("services") or {}
    edges = []
    for name, definition in services.items():
        declared = definition.get("depends_on") or {}
        items = declared.items() if isinstance(declared, dict) else ((item, {}) for item in declared)
        for target, options in items:
            if target not in services:
                raise ValueError(f"{project}:{name} depends on missing service {target}")
            edges.append((name, target, (options or {}).get("condition", "service_started")))
    return services, edges
