"""Listen to Docker's event stream and record container events."""
from event_store import store_event


def listen_for_events(client, connection, runtime):
    print("Listening for Docker events...")
    for event in client.events(decode=True):
        try:
            _handle_event(event, client, connection, runtime)
        except Exception as error:
            print("ERROR processing event:", error)
            connection.rollback()


def _handle_event(event, client, connection, runtime):
    event_type, action = event.get("Type"), event.get("Action")
    if event_type != "container":
        print(f"IGNORED: {event_type} | {action}")
        return
    actor = event.get("Actor") or {}
    attrs = actor.get("Attributes") or {}
    name = attrs.get("name", "unknown")
    container_id = actor.get("ID", "unknown")
    print(f"EVENT: {action} | {name} | {container_id[:12]}")
    store_event(event, client, connection, runtime)
