# Collector configuration

This folder owns connection setup only. PostgreSQL settings are read from the process environment. Neo4j settings are read from the process environment and can fall back to the user's private runtime-tracker env file.

```mermaid
flowchart LR
  ENV[Process environment] --> PG[db_connection.py]
  ENV --> NEO[neo4j_config.py]
  FILE[Private env file] --> NEO
  PG --> APP[Collector application]
  NEO --> GRAPH[Neo4j graph service]
```

Database credentials stay outside source files. `db_connection.py` opens PostgreSQL connections; `neo4j_config.py` validates Neo4j credentials before creating a driver.
