-- Admin-managed Compose paths used by the Docker graph synchronizer.
BEGIN;
CREATE TABLE IF NOT EXISTS compose_source (
    source_id SERIAL PRIMARY KEY,
    project_name VARCHAR(255) NOT NULL,
    compose_file TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_compose_project_name CHECK (length(trim(project_name)) > 0),
    CONSTRAINT chk_compose_file CHECK (length(trim(compose_file)) > 0)
);
COMMIT;
