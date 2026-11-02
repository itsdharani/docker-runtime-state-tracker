-- Docker Runtime Tracker SQL demonstrations. Run against runtime_tracker.
-- Read queries use live data. DML/DDL demonstrations are rolled back.

-- 01. Current containers (SELECT, ORDER BY).
SELECT container_id, container_name, service_name, current_state, restart_count, last_updated
FROM current_container_status ORDER BY last_updated DESC;

-- 02. Running and stopped containers (WHERE).
SELECT container_id, container_name, service_name, current_state
FROM current_container_status WHERE current_state = 'running';
SELECT container_id, container_name, service_name, current_state
FROM current_container_status WHERE current_state IN ('stopped', 'dead');

-- 03. Events of a chosen type and within a time range (parameters are examples).
SELECT c.name, e.event_type, e.event_time FROM container_event e
JOIN container c USING (container_id)
WHERE e.event_type = :'event_type'
  AND e.event_time >= :'from_time'::timestamp
  AND e.event_time < :'to_time'::timestamp
ORDER BY e.event_time DESC;

-- 04. Containers with lifecycle events (JOIN; event history by container).
SELECT c.container_id, c.name, s.name AS service, e.event_type, e.event_time
FROM container c JOIN service s USING (service_id)
LEFT JOIN container_event e USING (container_id)
ORDER BY c.name, e.event_time DESC;

-- 05. Services and their container instances (JOIN).
SELECT s.service_id, s.name AS service, c.container_id, c.name AS container
FROM service s LEFT JOIN container c USING (service_id)
ORDER BY s.name, c.name;

-- 06. Container counts by state (GROUP BY, COUNT).
SELECT current_state, count(*) AS containers
FROM current_container_status GROUP BY current_state ORDER BY containers DESC;

-- 07. Event counts by type (GROUP BY, aggregate).
SELECT event_type, count(*) AS event_count
FROM container_event GROUP BY event_type ORDER BY event_count DESC;

-- 08. Restart totals and most frequently restarted containers (aggregate/order).
SELECT container_name, service_name, restart_count
FROM current_container_status ORDER BY restart_count DESC, container_name;

-- 09. Services with more than one container instance (HAVING).
SELECT s.name, count(c.container_id) AS instances
FROM service s JOIN container c USING (service_id)
GROUP BY s.service_id, s.name HAVING count(c.container_id) > 1;

-- 10. Compose projects with more than three containers (GROUP BY, HAVING).
SELECT s.compose_project, count(c.container_id) AS containers
FROM service s JOIN container c USING (service_id)
GROUP BY s.compose_project
HAVING count(c.container_id) > 3;

-- 11. Containers with more events than the average (scalar subquery).
SELECT c.container_id, c.name, count(e.event_id) AS event_count
FROM container c LEFT JOIN container_event e USING (container_id)
GROUP BY c.container_id, c.name
HAVING count(e.event_id) > (SELECT avg(event_count) FROM (
  SELECT count(*) AS event_count FROM container_event GROUP BY container_id
) counts);

-- 12. Services with no currently running container (NOT EXISTS).
SELECT s.service_id, s.name FROM service s
WHERE NOT EXISTS (
  SELECT 1 FROM container c JOIN container_status cs USING (container_id)
  WHERE c.service_id = s.service_id AND cs.current_state = 'running'
);

-- 13. Latest event for each container (window function/subquery).
SELECT container_id, name, event_type, event_time FROM (
  SELECT c.container_id, c.name, e.event_type, e.event_time,
         row_number() OVER (PARTITION BY c.container_id ORDER BY e.event_time DESC) AS rank
  FROM container c JOIN container_event e USING (container_id)
) latest WHERE rank = 1 ORDER BY event_time DESC;

-- 14. Runtime status view (VIEW); inspect definition with \d+ current_container_status.
SELECT * FROM current_container_status WHERE current_state <> 'running';

-- 15. Constraints and foreign keys; inspect with \d container and \d container_event.
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint WHERE conrelid IN ('container'::regclass, 'container_event'::regclass);

-- 16. Indexes; inspect with \di+ idx_container_event*.
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = current_schema() AND tablename IN ('container_event', 'container_status');

-- 17. Trigger and function definition (trigger updates status after event INSERT).
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers WHERE event_object_table = 'container_event';

-- 18. Safe INSERT container/status/event + UPDATE + DELETE example. Rolls back all.
BEGIN;
SELECT 'query-demo-' || txid_current() AS demo_project \gset
INSERT INTO service (name, compose_project, image)
VALUES ('__query_demo__', :'demo_project', 'busybox');
INSERT INTO container (container_id, service_id, name, image)
SELECT md5(clock_timestamp()::text), service_id, '__query_demo__', 'busybox'
FROM service WHERE compose_project = :'demo_project';
INSERT INTO container_status (container_id, current_state)
SELECT container_id, 'created' FROM container WHERE name = '__query_demo__'
AND service_id = (SELECT service_id FROM service WHERE compose_project = :'demo_project');
INSERT INTO container_event (container_id, event_type)
SELECT container_id, 'create' FROM container WHERE name = '__query_demo__'
AND service_id = (SELECT service_id FROM service WHERE compose_project = :'demo_project');
UPDATE container SET image = 'busybox:latest' WHERE name = '__query_demo__'
AND service_id = (SELECT service_id FROM service WHERE compose_project = :'demo_project');
DELETE FROM container_event WHERE container_id IN (SELECT container_id FROM container
WHERE service_id = (SELECT service_id FROM service WHERE compose_project = :'demo_project'));
DELETE FROM container_status WHERE container_id IN (SELECT container_id FROM container
WHERE service_id = (SELECT service_id FROM service WHERE compose_project = :'demo_project'));
DELETE FROM container WHERE service_id = (SELECT service_id FROM service WHERE compose_project = :'demo_project');
DELETE FROM service WHERE compose_project = :'demo_project';
ROLLBACK;

-- 19. Safe CREATE/ALTER/DROP demonstration, isolated in a temporary table.
BEGIN;
CREATE TEMP TABLE query_demo (id integer PRIMARY KEY, note text NOT NULL);
ALTER TABLE query_demo ADD COLUMN created_at timestamp DEFAULT CURRENT_TIMESTAMP;
INSERT INTO query_demo (id, note) VALUES (1, 'transaction example');
SELECT * FROM query_demo;
DROP TABLE query_demo;
ROLLBACK;

-- 20. Explicit transaction example over real rows, read-only and rolled back.
BEGIN TRANSACTION READ ONLY;
SELECT current_state, count(*) FROM current_container_status GROUP BY current_state;
COMMIT;
