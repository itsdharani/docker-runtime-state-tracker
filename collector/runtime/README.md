# Runtime reconciliation

`runtime_sync.py` reads Docker's existing containers, maps Docker states to the relational state constraint, upserts PostgreSQL records, and synchronizes container nodes in Neo4j. It also marks database records absent from Docker as removed while preserving their history.

```mermaid
flowchart LR
  D[Docker containers.list all] --> R[runtime_sync.py]
  R --> DB[container_store.py]
  DB --> PG[(PostgreSQL current state)]
  R --> RG[RuntimeService]
  RG --> N[(Neo4j Container nodes)]
  R --> M[Mark missing containers removed]
```

The collector runs this reconciliation once at startup, before subscribing to new events. This repairs state after collector downtime.
