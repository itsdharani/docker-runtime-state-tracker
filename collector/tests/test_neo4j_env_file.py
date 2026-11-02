import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from collector.config.neo4j_config import create_neo4j_driver


class Neo4jEnvFileTests(unittest.TestCase):
    def test_reads_quoted_password_from_env_file(self):
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
        self.assertEqual(calls[0][1][1], "temporary value # with spaces")


if __name__ == "__main__":
    unittest.main()
