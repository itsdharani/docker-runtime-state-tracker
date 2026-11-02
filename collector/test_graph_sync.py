import unittest
from unittest.mock import patch
from pathlib import Path
from tempfile import TemporaryDirectory

from graph_sync import read_project
from compose_sources import compose_sources


class ComposeDiscoveryTests(unittest.TestCase):
    def test_discovers_multiple_projects_and_files_from_labels(self):
        containers = [
            type("Container", (), {"labels": {
                "com.docker.compose.project": "shop",
                "com.docker.compose.project.config_files": "base.yml,override.yml",
            }})(),
            type("Container", (), {"labels": {
                "com.docker.compose.project": "billing",
                "com.docker.compose.project.config_files": "billing.yml",
            }})(),
        ]
        client = type("Client", (), {"containers": type("Collection", (), {"list": lambda self, all: containers})()})()
        with patch.dict("os.environ", {}, clear=True):
            sources = compose_sources(client)
        self.assertEqual(set(sources), {"shop", "billing"})
        self.assertEqual(len(sources["shop"]), 2)

    def test_reads_independent_and_dependent_services(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "compose.yml"
            path.write_text(
                "services:\n  web:\n    depends_on:\n      api:\n        condition: service_healthy\n  api: {}\n  cache: {}\n",
                encoding="utf-8",
            )
            services, edges = read_project("shop", path)
        self.assertEqual(set(services), {"web", "api", "cache"})
        self.assertEqual(edges, [("web", "api", "service_healthy")])

    def test_rejects_dependency_not_declared_as_service(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "compose.yml"
            path.write_text("services:\n  web:\n    depends_on: [missing]\n")
            with self.assertRaisesRegex(ValueError, "missing service"):
                read_project("shop", path)

    def test_merges_multiple_compose_files_for_one_project(self):
        with TemporaryDirectory() as directory:
            base = Path(directory) / "compose.yml"
            override = Path(directory) / "override.yml"
            base.write_text("services:\n  web:\n    depends_on: [api]\n  api: {}\n")
            override.write_text("services:\n  api:\n    depends_on: [database]\n  database: {}\n")
            services, edges = read_project("shop", [base, override])
        self.assertEqual(set(services), {"web", "api", "database"})
        self.assertEqual(set(edges), {("web", "api", "service_started"), ("api", "database", "service_started")})


if __name__ == "__main__":
    unittest.main()
