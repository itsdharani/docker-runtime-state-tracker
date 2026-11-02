"""Manage the optional Neo4j runtime graph connection."""
import os

from neo4j import GraphDatabase
from collector.config.neo4j_config import create_neo4j_driver
from collector.graph.runtime_graph import RuntimeGraph


class RuntimeService:
    def __init__(self):
        self.driver = None
        self.graph = None

    def connect(self):
        if self.graph:
            return self.graph
        self.driver = create_neo4j_driver(GraphDatabase.driver)
        self.driver.verify_connectivity()
        project = os.getenv("GRAPH_PROJECT_NAME", "runtime-tracker")
        self.graph = RuntimeGraph(self.driver, project)
        self.graph.ensure_schema()
        return self.graph

    def close(self):
        if self.driver:
            self.driver.close()
        self.driver = None
        self.graph = None
