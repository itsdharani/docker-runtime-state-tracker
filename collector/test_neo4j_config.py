import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from neo4j_config import create_neo4j_driver


class Neo4jConfigTests(unittest.TestCase):
    def test_passes_exported_environment_credentials_to_driver(self):
        calls = []

        def driver_factory(uri, *, auth):
            calls.append((uri, auth))
            return "driver"

        secret = "opaque test secret"
        result = create_neo4j_driver(
            driver_factory,
            {
                "NEO4J_URI": "bolt://db.example:7687",
                "NEO4J_USERNAME": "neo4j",
                "NEO4J_PASSWORD": secret,
            },
        )

        self.assertEqual(result, "driver")
        self.assertEqual(calls, [("bolt://db.example:7687", ("neo4j", secret))])

    def test_missing_or_empty_password_fails_before_driver_creation(self):
        def unexpected_driver(*_args, **_kwargs):
            self.fail("driver must not be called without all credentials")

        with self.assertRaisesRegex(RuntimeError, "NEO4J_PASSWORD"):
            create_neo4j_driver(
                unexpected_driver,
                {"NEO4J_URI": "bolt://localhost:7687", "NEO4J_USERNAME": "neo4j"},
            )

        with self.assertRaisesRegex(RuntimeError, "NEO4J_PASSWORD"):
            create_neo4j_driver(
                unexpected_driver,
                {
                    "NEO4J_URI": "bolt://localhost:7687",
                    "NEO4J_USERNAME": "neo4j",
                    "NEO4J_PASSWORD": "   ",
                },
            )

    def test_falls_back_to_env_file_when_process_variables_are_absent(self):
        calls = []

        def driver_factory(uri, *, auth):
            calls.append((uri, auth))
            return "driver"

        with TemporaryDirectory() as directory:
            config = Path(directory) / "env"
            config.write_text(
                "NEO4J_URI=bolt://localhost:7687\n"
                "NEO4J_USERNAME=neo4j\n"
                "NEO4J_PASSWORD='temporary value # with spaces'\n",
                encoding="utf-8",
            )
            create_neo4j_driver(driver_factory, environ={}, env_file=config)

        self.assertEqual(
            calls,
            [("bolt://localhost:7687", ("neo4j", "temporary value # with spaces"))],
        )

if __name__ == "__main__":
    unittest.main()
