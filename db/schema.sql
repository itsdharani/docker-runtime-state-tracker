-- 1. USERS
CREATE TABLE app_user (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,

    role VARCHAR(30) NOT NULL
        CHECK (role IN ('ADMIN', 'VIEWER'))
);
-- 2. DOCKER COMPOSE SERVICES
CREATE TABLE service (
    service_id SERIAL PRIMARY KEY,

    name VARCHAR(100) NOT NULL,

    compose_project VARCHAR(255) NOT NULL DEFAULT 'standalone',

    image VARCHAR(255),

    compose_file TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_service_project_name UNIQUE (compose_project, name)
);
-- 3. SERVICE DEPENDENCIES
-- Self-referencing relationship
-- Example:
-- frontend -> api
-- api      -> postgres
-- api      -> redis

CREATE TABLE service_dependency (
    service_id INTEGER NOT NULL,

    depends_on_service_id INTEGER NOT NULL,

    dependency_type VARCHAR(50),

    PRIMARY KEY (service_id, depends_on_service_id),

    CONSTRAINT fk_dependency_service
        FOREIGN KEY (service_id)
        REFERENCES service(service_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_dependency_target
        FOREIGN KEY (depends_on_service_id)
        REFERENCES service(service_id)
        ON DELETE CASCADE,

    CONSTRAINT chk_no_self_dependency
        CHECK (service_id <> depends_on_service_id)
);
-- 4. CONTAINERS
CREATE TABLE container (
    container_id VARCHAR(64) PRIMARY KEY,

    service_id INTEGER NOT NULL,

    name VARCHAR(255) NOT NULL,

    image VARCHAR(255),

    started_at TIMESTAMP,

    stopped_at TIMESTAMP,

    health_check_url TEXT,

    CONSTRAINT fk_container_service
        FOREIGN KEY (service_id)
        REFERENCES service(service_id)
        ON DELETE RESTRICT
);
-- 5. CURRENT CONTAINER STATUS
-- One row per container.
-- This is NOT the history.
-- History is stored in container_event.

CREATE TABLE container_status (
    container_id VARCHAR(64) PRIMARY KEY,

    current_state VARCHAR(50) NOT NULL
        CHECK (
            current_state IN (
                'created',
                'running',
                'paused',
                'restarting',
                'stopped',
                'dead',
                'removed',
                'unknown'
            )
        ),

    last_event_type VARCHAR(50),

    last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    restart_count INTEGER NOT NULL DEFAULT 0
        CHECK (restart_count >= 0),

    CONSTRAINT fk_status_container
        FOREIGN KEY (container_id)
        REFERENCES container(container_id)
        ON DELETE CASCADE
);

-- 6. CONTAINER EVENT HISTORY
-- Structured information extracted from Docker events.
-- Structured information extracted from Docker events.

CREATE TABLE container_event (
    event_id BIGSERIAL PRIMARY KEY,

    container_id VARCHAR(64) NOT NULL,

    event_type VARCHAR(50) NOT NULL,

    event_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_event_container
        FOREIGN KEY (container_id)
        REFERENCES container(container_id)
        ON DELETE RESTRICT
);
-- 7. DOCKER NETWORKS
CREATE TABLE network (
    network_id VARCHAR(64) PRIMARY KEY,

    name VARCHAR(255) NOT NULL,

    driver VARCHAR(50),

    subnet VARCHAR(50)
);
-- 8. CONTAINER <-> NETWORK
-- Many-to-many relationship
-- Attributes belong to the relationship:
-- IP address
-- MAC address
CREATE TABLE container_network (
    container_id VARCHAR(64) NOT NULL,

    network_id VARCHAR(64) NOT NULL,

    ip_address VARCHAR(45),

    mac_address VARCHAR(17),

    connected_at TIMESTAMP,

    disconnected_at TIMESTAMP,

    PRIMARY KEY (container_id, network_id),

    CONSTRAINT fk_cn_container
        FOREIGN KEY (container_id)
        REFERENCES container(container_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_cn_network
        FOREIGN KEY (network_id)
        REFERENCES network(network_id)
        ON DELETE CASCADE
);

-- 9. DOCKER VOLUMES

CREATE TABLE volume (
    volume_id VARCHAR(64) PRIMARY KEY,

    name VARCHAR(255) NOT NULL,

    driver VARCHAR(50)
);

-- 10. CONTAINER <-> VOLUME
-- Many-to-many relationship
--
-- Attributes belong to the relationship:
-- mount path
-- read-only status

CREATE TABLE container_volume (
    container_id VARCHAR(64) NOT NULL,

    volume_id VARCHAR(64) NOT NULL,

    mount_path VARCHAR(500) NOT NULL,

    read_only BOOLEAN NOT NULL DEFAULT FALSE,

    PRIMARY KEY (container_id, volume_id, mount_path),

    CONSTRAINT fk_cv_container
        FOREIGN KEY (container_id)
        REFERENCES container(container_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_cv_volume
        FOREIGN KEY (volume_id)
        REFERENCES volume(volume_id)
        ON DELETE CASCADE
);
-- 11. INDEXES
-- Useful for event/history queries

CREATE INDEX idx_container_service
    ON container(service_id);

CREATE INDEX idx_container_event_container
    ON container_event(container_id);

CREATE INDEX idx_container_event_time
    ON container_event(event_time);

CREATE INDEX idx_container_event_type
    ON container_event(event_type);

CREATE INDEX idx_container_network_network
    ON container_network(network_id);

CREATE INDEX idx_container_volume_volume
    ON container_volume(volume_id);

CREATE INDEX idx_dependency_target
    ON service_dependency(depends_on_service_id);
