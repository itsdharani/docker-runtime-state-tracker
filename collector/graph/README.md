# Dependency and runtime graph

This folder builds the Neo4j model from Docker Compose labels/configuration and upserts actual container nodes. Compose `depends_on` is the only source of service dependency edges; networks and names are not used to infer dependencies.

```mermaid
flowchart TD
  LABELS[Docker Compose labels] --> SOURCES[compose_sources.py]
  REGISTRY[PostgreSQL registered paths] --> SOURCES
  YAML[Compose YAML files] --> PARSE[compose_discovery.py]
  SOURCES --> PARSE
  PARSE --> SYNC[graph_sync.py]
  SYNC --> S[Service nodes]
  SYNC --> DEP[DEPENDS_ON edges]
  RUNTIME[runtime_service.py] --> C[Container nodes]
  C --> INST[INSTANCE_OF edges]
  INST --> S
  S --> N[(Neo4j)]
  DEP --> N
  C --> N
```

`Service.service_id` is project-scoped. `Container.container_id` is the full Docker ID. Synchronization uses `MERGE`; unreadable Compose files are reported and marked unavailable without discarding the prior graph. Removed service nodes remain available as undiscovered history.
