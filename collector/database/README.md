# PostgreSQL persistence

These modules contain small parameterized statements for logical service and container rows. They do not open connections; callers supply a PostgreSQL cursor so event inserts and state changes remain inside the caller's transaction.

```mermaid
flowchart LR
  Docker[Container metadata] --> CS[container_store.py]
  CS --> SS[service_store.py]
  CS --> CT[container table]
  SS --> ST[service table]
  CT --> STATUS[container_status table]
  EVENT[events package] --> HISTORY[container_event table]
```

Service identity is scoped by Compose project plus service name. Standalone container records reuse an existing service association when reconciled and do not gain inferred graph dependencies.
