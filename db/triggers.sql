-- Docker Runtime Tracker
-- PostgreSQL Triggers


-- 1. FUNCTION: UPDATE CONTAINER STATUS

CREATE OR REPLACE FUNCTION update_container_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    -- Container started

    IF NEW.event_type = 'start' THEN

        UPDATE container_status
        SET
            current_state = 'running',
            last_event_type = NEW.event_type,
            last_updated = NEW.event_time,

            -- A start after the container already existed
            -- represents another run/restart.
            restart_count =
                CASE
                    WHEN last_event_type IN (
                        'stop',
                        'die',
                        'kill',
                        'restart'
                    )
                    THEN restart_count + 1
                    ELSE restart_count
                END

        WHERE container_id = NEW.container_id;


    -- Container stopped

    ELSIF NEW.event_type = 'stop' THEN

        UPDATE container_status
        SET
            current_state = 'stopped',
            last_event_type = NEW.event_type,
            last_updated = NEW.event_time

        WHERE container_id = NEW.container_id;


    -- Container died

    ELSIF NEW.event_type = 'die' THEN

        UPDATE container_status
        SET
            current_state = 'dead',
            last_event_type = NEW.event_type,
            last_updated = NEW.event_time

        WHERE container_id = NEW.container_id;


    -- Container killed

    ELSIF NEW.event_type = 'kill' THEN

        UPDATE container_status
        SET
            current_state = 'dead',
            last_event_type = NEW.event_type,
            last_updated = NEW.event_time

        WHERE container_id = NEW.container_id;


    -- Container restarted

    ELSIF NEW.event_type = 'restart' THEN

        UPDATE container_status
        SET
            current_state = 'running',
            last_event_type = NEW.event_type,
            last_updated = NEW.event_time

        WHERE container_id = NEW.container_id;


    -- Container created

    ELSIF NEW.event_type = 'create' THEN

        UPDATE container_status
        SET
            current_state = 'created',
            last_event_type = NEW.event_type,
            last_updated = NEW.event_time

        WHERE container_id = NEW.container_id;


    -- Container paused

    ELSIF NEW.event_type = 'pause' THEN

        UPDATE container_status
        SET
            current_state = 'paused',
            last_event_type = NEW.event_type,
            last_updated = NEW.event_time

        WHERE container_id = NEW.container_id;


    -- Container unpaused

    ELSIF NEW.event_type = 'unpause' THEN

        UPDATE container_status
        SET
            current_state = 'running',
            last_event_type = NEW.event_type,
            last_updated = NEW.event_time

        WHERE container_id = NEW.container_id;

    END IF;


    RETURN NEW;

END;
$$;


-- 2. CREATE TRIGGER

DROP TRIGGER IF EXISTS trg_container_event_status
ON container_event;


CREATE TRIGGER trg_container_event_status

AFTER INSERT ON container_event

FOR EACH ROW

EXECUTE FUNCTION update_container_status();
