-- VIEW 1: CURRENT CONTAINER STATUS

CREATE OR REPLACE VIEW current_container_status AS
SELECT
    c.container_id,
    c.name AS container_name,
    s.name AS service_name,
    s.image AS service_image,
    c.image AS container_image,
    cs.current_state,
    cs.last_event_type,
    cs.restart_count,
    cs.last_updated
FROM container c
JOIN service s
    ON c.service_id = s.service_id
JOIN container_status cs
    ON c.container_id = cs.container_id;


-- VIEW 2: CONTAINER NETWORK INFORMATION

CREATE OR REPLACE VIEW container_network_details AS
SELECT
    c.name AS container_name,
    n.name AS network_name,
    n.driver,
    n.subnet,
    cn.ip_address,
    cn.mac_address
FROM container_network cn
JOIN container c
    ON cn.container_id = c.container_id
JOIN network n
    ON cn.network_id = n.network_id;


-- VIEW 3: CONTAINER EVENT HISTORY

CREATE OR REPLACE VIEW container_event_history AS
SELECT
    c.name AS container_name,
    s.name AS service_name,
    e.event_type,
    e.event_time,
    e.mongo_ref
FROM container_event e
JOIN container c
    ON e.container_id = c.container_id
JOIN service s
    ON c.service_id = s.service_id;
