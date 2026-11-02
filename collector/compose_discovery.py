"""Read and merge declared dependencies from Compose YAML files."""
from pathlib import Path

import yaml


def read_project(project, paths):
    services = {}
    paths = paths if isinstance(paths, (list, tuple)) else [paths]
    for path in paths:
        with Path(path).resolve().open(encoding="utf-8") as source:
            config = yaml.safe_load(source) or {}
        for name, definition in (config.get("services") or {}).items():
            current = services.setdefault(name, {})
            declared = definition.get("depends_on")
            if declared is not None:
                current["depends_on"] = merge_dependencies(current.get("depends_on"), declared)
    return services, dependency_edges(project, services)


def dependency_edges(project, services):
    edges = []
    for name, definition in services.items():
        declared = definition.get("depends_on") or {}
        items = declared.items() if isinstance(declared, dict) else ((item, {}) for item in declared)
        for target, options in items:
            if target not in services:
                raise ValueError(f"{project}:{name} depends on missing service {target}")
            edges.append((name, target, (options or {}).get("condition", "service_started")))
    return edges


def merge_dependencies(base, override):
    merged = _normalize_dependencies(base)
    merged.update(_normalize_dependencies(override))
    return merged


def _normalize_dependencies(value):
    if isinstance(value, list):
        return {name: {} for name in value}
    return value or {}
