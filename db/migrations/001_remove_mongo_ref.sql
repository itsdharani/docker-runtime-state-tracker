-- Apply once to an existing database before deploying code that uses the
-- MongoDB-free event history. This preserves all event rows and other data.
BEGIN;
DROP VIEW IF EXISTS container_event_history;
ALTER TABLE container_event DROP COLUMN IF EXISTS mongo_ref;
CREATE VIEW container_event_history AS
SELECT
    c.name AS container_name,
    s.name AS service_name,
    e.event_type,
    e.event_time
FROM container_event e
JOIN container c ON e.container_id = c.container_id
JOIN service s ON c.service_id = s.service_id;
COMMIT;
