"""PostgreSQL connection settings for the runtime collector."""
import os

import psycopg


def connect_postgres():
    """Open the configured PostgreSQL connection."""
    return psycopg.connect(
        host=os.getenv("PGHOST", "127.0.0.1"),
        port=int(os.getenv("PGPORT", "5432")),
        dbname=os.getenv("PGDATABASE", "runtime_tracker"),
        user=os.getenv("PGUSER", "tracker"),
        password=os.getenv("PGPASSWORD"),
    )
