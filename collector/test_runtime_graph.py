import unittest

from runtime_graph import RuntimeGraph, event_state


class RecordingSession:
    def __init__(self, calls):
        self.calls = calls

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def run(self, query, **parameters):
        self.calls.append((query, parameters))
        return self

    def consume(self):
        return None


class RecordingDriver:
    def __init__(self):
        self.calls = []

    def session(self):
        return RecordingSession(self.calls)


class RuntimeGraphTests(unittest.TestCase):
    def test_lifecycle_actions_map_to_runtime_states(self):
        self.assertEqual(event_state("start"), "running")
        self.assertEqual(event_state("die"), "dead")
        self.assertEqual(event_state("destroy"), "removed")
        self.assertEqual(event_state("new-event"), "unknown")

    def test_stable_full_id_and_compose_service_association(self):
        driver = RecordingDriver()
        graph = RuntimeGraph(driver, "runtime-tracker")
        graph.upsert_container(
            container_id="a" * 64,
            name="demo-api-1",
            image="nginx:latest",
            status="running",
            labels={
                "com.docker.compose.service": "api",
                "com.docker.compose.project": "demo",
            },
        )
        self.assertEqual(len(driver.calls), 3)
        self.assertIn("MERGE (c:Container {container_id: $id})", driver.calls[0][0])
        self.assertEqual(driver.calls[0][1]["id"], "a" * 64)
        self.assertEqual(driver.calls[1][1]["service_id"], "demo:api")

    def test_standalone_container_does_not_gain_a_service_or_dependency(self):
        driver = RecordingDriver()
        RuntimeGraph(driver).upsert_container(
            container_id="b" * 64, name="random", image="busybox",
            status="created", labels={},
        )
        self.assertEqual(len(driver.calls), 1)
        self.assertIsNone(driver.calls[0][1]["compose_service"])


if __name__ == "__main__":
    unittest.main()
