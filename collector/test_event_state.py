import unittest

from event_state import event_state


class EventStateTests(unittest.TestCase):
    def test_maps_lifecycle_actions_to_runtime_states(self):
        self.assertEqual(event_state("start"), "running")
        self.assertEqual(event_state("die"), "dead")
        self.assertEqual(event_state("destroy"), "removed")
        self.assertEqual(event_state("new-event"), "unknown")


if __name__ == "__main__":
    unittest.main()
