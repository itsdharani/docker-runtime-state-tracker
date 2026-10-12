# Dashboard

This Next.js dashboard reads runtime status and event history from PostgreSQL and declared service dependencies from Neo4j. All database access stays in server-side API routes.

From the repository root, load the private database settings before starting the dashboard. The settings use native PostgreSQL at `127.0.0.1:5432` and the existing host authentication:

```sh
set -a
. "$HOME/.config/runtime-tracker/env"
set +a
docker compose -f docker-compose.yml up -d neo4j
cd dashboard
npm ci
npm run dev
```

Pages: `/` for container overview, `/events` for PostgreSQL event history, and `/dependencies` for the Neo4j dependency graph. API routes are under `/api`; the dependency query endpoint accepts `service` and `kind` (`direct`, `dependents`, `transitive`, or `impact`).

See the repository [README](../README.md) for database initialization, collector setup, graph synchronization, and example queries.
