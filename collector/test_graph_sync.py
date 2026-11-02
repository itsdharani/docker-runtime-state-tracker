import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from graph_sync import read_project


class ComposeDiscoveryTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
