"""Discover Compose config files from Docker labels and explicit registrations."""
import os
from pathlib import Path


def compose_sources(client=None, registered_sources=None):
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
                sources.setdefault(project, []).append(Path(filename.strip()))
    for project, filename in registered_sources or []:
        sources.setdefault(project, []).append(Path(filename).expanduser())
    _add_registered_sources(sources)
    return {name: list(dict.fromkeys(paths)) for name, paths in sources.items()}


def _add_registered_sources(sources):
    registered = os.getenv("COMPOSE_PATHS", "")
    entries = registered.split(os.pathsep) if registered else []
    if not entries and not sources and os.getenv("COMPOSE_FILE"):
        entries = [f"{os.getenv('GRAPH_PROJECT_NAME', 'runtime-tracker')}={os.getenv('COMPOSE_FILE')}"]
    for entry in entries:
        if entry.strip():
            project_name, separator, filename = entry.partition("=")
            path = Path(filename if separator else entry).expanduser()
            project = project_name if separator else (path.parent.name or path.stem)
            sources.setdefault(project, []).append(path)
