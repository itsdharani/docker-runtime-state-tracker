# Database query demonstrations

The runnable query collections are [PostgreSQL](demo_queries.sql) and [Neo4j Cypher](demo_queries.cypher). They use the project's actual `service`, `container`, `container_status`, and `container_event` schema and `Service`, `Container`, `DEPENDS_ON`, and `INSTANCE_OF` graph model.

## PostgreSQL guide

Run read queries in `psql` connected to `runtime_tracker`. Sections 01–17 report live rows and catalog metadata. Sections 18–19 are isolated demonstrations enclosed in transactions and end in `ROLLBACK`; section 20 is read-only. Do not remove the rollback statements when demonstrating against the active database.

| Sections | Purpose and expected result | Concept |
| --- | --- | --- |
| 01–03 | Current state, state filters, and parameterized time/event filters return matching live containers/events. | SELECT, WHERE, ORDER BY |
| 04–05 | Container events and service instances are combined with their parent rows; containers without events remain visible. | JOIN, LEFT JOIN |
| 06–08 | Live totals are grouped by state/event type and restart count is sorted. | GROUP BY, COUNT, aggregate, ORDER BY |
| 09–10 | Only services with multiple instances and compose files over the chosen threshold are returned. | HAVING |
| 11–13 | Rows above the mean, services without running instances, and each container's latest event are selected. | Subquery, NOT EXISTS, window function |
| 14–17 | Runtime view rows and PostgreSQL metadata show view, constraints/FKs, indexes, and event trigger definitions. | VIEW, constraints, indexes, TRIGGER |
| 18 | A temporary service, container, status, and event are inserted, updated, and deleted; rollback leaves no project data. | INSERT, UPDATE, DELETE, trigger, transaction |
| 19–20 | A temporary table is created, altered, queried, and dropped inside rollback; a read-only transaction groups current state. | CREATE, ALTER, DROP, transaction |

The service schema stores the Compose project label and configuration path; section 10 groups by the actual project namespace.

### Captured PostgreSQL result sample

The SQL collection was executed on 2026-11-02 against the configured `runtime_tracker` database. After the Docker lifecycle smoke test, the state aggregation returned: `created=1`, `removed=7`, `stopped=21`. The event aggregation returned: `create=13`, `destroy=6`, `die=13`, `exec_create: mongosh=1`, `exec_die=1`, `exec_start: mongosh=1`, `kill=19`, `restart=2`, `start=17`, `stop=12`. These are captured environment results, not expected constants; values change as Docker events arrive. The complete SQL file also ran with its DML/DDL demonstrations and rolled them back successfully.

## Neo4j guide

Open `db/demo_queries.cypher` in Neo4j Browser. Sections 01–04 inspect only discovered graph data. Set `$service_id` to a `Service.service_id` returned by section 01; set `$from_service_id` and `$to_service_id` to actual IDs for path queries. Sections 05–12 demonstrate directed traversal and possible downstream impact; impact means dependency reachability, not guaranteed failure. Sections 13–14 show idempotent schema constraints/indexes. Sections 15–16 are parameterized maintenance examples and mutate only the selected real node or matching edge.

| Sections | Purpose and expected result | Concept |
| --- | --- | --- |
| 01–04 | Discovered services, containers, declared edges, and actual instance membership. | Graph pattern matching |
| 05–08 | Direct/transitive requirements and direct/transitive dependents with shortest impact distance. | Directed and variable-length traversal |
| 09–10 | Services with no outgoing requirements and services with multiple direct dependents. | Optional topology, aggregation |
| 11–12 | Declared dependency chains and shortest path between two selected services. | Path queries |
| 13–14 | Stable ID constraints and project lookup index. | Uniqueness, index |
| 15–16 | Set a review timestamp on one selected service or remove one specifically matched dependency edge. | SET, DELETE |

## Application integration

The server-side route handlers use parameterized SQL for container status and event history (`current_container_status`, `container_event_history`) and parameterized Cypher for graph reads and dependency traversal. Browser code calls only these Next.js routes; database credentials stay in server environment variables. The overview currently presents the live container list; aggregate dashboard cards and a dedicated impact page remain rubric gaps.

## Capturing actual results

The SELECT sections intentionally do not include made-up result rows. Capture their output from your running project when preparing the demonstration, since container and event rows depend on the Docker host at run time. Neo4j Browser screenshots and PostgreSQL query output belong in the project report after running the live queries.
