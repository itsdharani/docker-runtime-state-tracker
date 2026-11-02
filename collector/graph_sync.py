"""Compatibility entry point for manual dependency graph synchronization."""
from collector.graph.graph_sync import synchronize_dependency_graph


if __name__ == "__main__":
    synchronize_dependency_graph()
