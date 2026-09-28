-- DATABASE INDEXES

-- Fast lookup of events belonging to a container
CREATE INDEX IF NOT EXISTS idx_container_event_container
ON container_event(container_id);


-- Fast lookup of events by type
CREATE INDEX IF NOT EXISTS idx_container_event_type
ON container_event(event_type);


-- Fast chronological event-history queries
CREATE INDEX IF NOT EXISTS idx_container_event_time
ON container_event(event_time);


-- Useful for queries such as:
-- "show me all events for this container ordered by time"
CREATE INDEX IF NOT EXISTS idx_container_event_container_time
ON container_event(container_id, event_time);


-- Useful for finding containers by service
CREATE INDEX IF NOT EXISTS idx_container_service
ON container(service_id);


-- Useful for filtering containers by current state
CREATE INDEX IF NOT EXISTS idx_container_status_state
ON container_status(current_state);


-- Useful for finding services by name
CREATE INDEX IF NOT EXISTS idx_service_name
ON service(name);
