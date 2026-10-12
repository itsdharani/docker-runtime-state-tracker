"""Shared Neo4j driver configuration for the collector and graph sync."""

import os
from pathlib import Path
import shlex


NEO4J_SETTINGS = ("NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD")


def _read_env_file(path):
    settings = {}
    try:
        lines = Path(path).expanduser().read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        return settings

    for line in lines:
        entry = line.strip()
        if not entry or entry.startswith("#"):
            continue
        if entry.startswith("export "):
            entry = entry[7:].lstrip()
        key, separator, raw_value = entry.partition("=")
        key = key.strip()
        if not separator or key not in NEO4J_SETTINGS:
            continue

        raw_value = raw_value.strip()
        if raw_value.startswith(("'", '"')):
            parsed = shlex.split(raw_value, comments=True, posix=True)
            value = parsed[0] if parsed else ""
        else:
            # In dotenv syntax, whitespace before # starts an inline comment.
            value = raw_value.split(" #", 1)[0].rstrip()
        settings[key] = value
    return settings


def create_neo4j_driver(driver_factory, environ=None, env_file=None):
    """Create a driver from process settings, falling back to the user's config file."""
    process_env = os.environ if environ is None else environ
    values = {name: process_env.get(name, "") for name in NEO4J_SETTINGS}
    if env_file is None and environ is None:
        env_file = Path.home() / ".config/runtime-tracker/env"
    if env_file is not None:
        file_values = _read_env_file(env_file)
        for name in NEO4J_SETTINGS:
            if not values[name].strip():
                values[name] = file_values.get(name, "")

    missing = [name for name, value in values.items() if not value.strip()]
    if missing:
        raise RuntimeError(
            "Missing or empty Neo4j setting(s): " + ", ".join(missing) +
            ". Set them in the process environment or in ~/.config/runtime-tracker/env."
        )

    return driver_factory(
        values["NEO4J_URI"].strip(),
        auth=(values["NEO4J_USERNAME"], values["NEO4J_PASSWORD"]),
    )
