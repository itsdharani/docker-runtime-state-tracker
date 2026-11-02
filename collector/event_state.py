"""Map Docker lifecycle actions to relational and graph runtime states."""


def event_state(action):
    return {
        "create": "created", "start": "running", "restart": "running",
        "stop": "stopped", "die": "dead", "kill": "dead",
        "pause": "paused", "unpause": "running", "destroy": "removed",
        "oom": "dead",
    }.get(action, "unknown")
