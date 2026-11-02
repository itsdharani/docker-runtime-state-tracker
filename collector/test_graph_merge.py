import unittest

from graph_sync import sync_project
from test_fakes import RecordingSession


class GraphMergeTests(unittest.TestCase):
    def test_merge_updates_edges_and_preserves_historical_nodes(self):
        calls = []
        session = RecordingSession(calls)
        sync_project(session, "shop", "compose.yml", {"web": {}, "api": {}}, [("web", "api", "service_started")])
        self.assertIn("MERGE (s:Service", calls[0][0])
        self.assertIn("MERGE (a)-[r:DEPENDS_ON]->(b)", calls[2][0])
        self.assertIn("SET s.discovered=false", calls[3][0])
        self.assertNotIn("DETACH DELETE", calls[3][0])


if __name__ == "__main__":
    unittest.main()
