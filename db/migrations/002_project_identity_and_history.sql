-- Add project-aware logical service identity without deleting runtime history.
BEGIN;

ALTER TABLE service ADD COLUMN IF NOT EXISTS compose_project VARCHAR(255);
UPDATE service SET compose_project = CASE
    WHEN compose_file IS NULL THEN 'standalone'
    ELSE 'legacy'
END WHERE compose_project IS NULL;
ALTER TABLE service ALTER COLUMN compose_project SET DEFAULT 'standalone';
ALTER TABLE service ALTER COLUMN compose_project SET NOT NULL;
ALTER TABLE service DROP CONSTRAINT IF EXISTS service_name_key;
ALTER TABLE service DROP CONSTRAINT IF EXISTS uq_service_project_name;
ALTER TABLE service ADD CONSTRAINT uq_service_project_name UNIQUE (compose_project, name);

ALTER TABLE container DROP CONSTRAINT IF EXISTS fk_container_service;
ALTER TABLE container ADD CONSTRAINT fk_container_service
    FOREIGN KEY (service_id) REFERENCES service(service_id) ON DELETE RESTRICT;

ALTER TABLE container_event DROP CONSTRAINT IF EXISTS fk_event_container;
ALTER TABLE container_event ADD CONSTRAINT fk_event_container
    FOREIGN KEY (container_id) REFERENCES container(container_id) ON DELETE RESTRICT;

ALTER TABLE container_status DROP CONSTRAINT IF EXISTS container_status_current_state_check;
ALTER TABLE container_status ADD CONSTRAINT container_status_current_state_check
    CHECK (current_state IN ('created', 'running', 'paused', 'restarting',
                             'stopped', 'dead', 'removed', 'unknown'));

CREATE OR REPLACE VIEW current_container_status AS
SELECT c.container_id, c.name AS container_name, s.name AS service_name,
       s.image AS service_image, c.image AS container_image,
       cs.current_state, cs.last_event_type, cs.restart_count, cs.last_updated,
       s.compose_project, s.compose_file
FROM container c JOIN service s USING (service_id)
JOIN container_status cs USING (container_id);

COMMIT;
