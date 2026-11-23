"""Pruebas de la heuristica de caidas sin cargar torch ni ultralytics.

Se ejecutan con:

    python -m unittest tests.test_falls -v
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import detector  # noqa: E402


def person(x1, y1, x2, y2):
    return {"x1": x1, "y1": y1, "x2": x2, "y2": y2}


VERTICAL = person(0, 0, 100, 200)  # ancho/alto = 0.50
HORIZONTAL = person(0, 0, 200, 100)  # ancho/alto = 2.00


class FallTrackerTest(unittest.TestCase):
    def test_vertical_box_is_normal(self):
        tracker = detector._FallTracker(ratio=1.05, grace=3.0)
        payload = tracker.update(1, VERTICAL, 0.0)
        self.assertEqual(payload["status"], "normal")
        self.assertFalse(payload["suspect"])
        self.assertEqual(payload["seconds"], 0.0)
        self.assertEqual(payload["ratio"], 0.5)

    def test_horizontal_box_starts_as_suspect(self):
        tracker = detector._FallTracker(ratio=1.05, grace=3.0)
        payload = tracker.update(1, HORIZONTAL, 10.0)
        self.assertEqual(payload["status"], "suspect")
        self.assertTrue(payload["suspect"])
        self.assertFalse(payload["fallen"])
        self.assertEqual(payload["ratio"], 2.0)

    def test_grace_confirms_fall(self):
        tracker = detector._FallTracker(ratio=1.05, grace=3.0)
        tracker.update(1, HORIZONTAL, 10.0)
        payload = tracker.update(1, HORIZONTAL, 12.9)
        self.assertEqual(payload["status"], "suspect")
        self.assertAlmostEqual(payload["seconds"], 2.9)
        payload = tracker.update(1, HORIZONTAL, 13.1)
        self.assertEqual(payload["status"], "fallen")
        self.assertTrue(payload["fallen"])
        self.assertAlmostEqual(payload["seconds"], 3.1)

    def test_without_track_id_never_confirms(self):
        tracker = detector._FallTracker(ratio=1.05, grace=3.0)
        tracker.update(None, HORIZONTAL, 0.0)
        payload = tracker.update(None, HORIZONTAL, 30.0)
        self.assertEqual(payload["status"], "suspect")
        self.assertFalse(payload["fallen"])
        self.assertEqual(payload["seconds"], 0.0)

    def test_recovery_resets_timer(self):
        tracker = detector._FallTracker(ratio=1.05, grace=3.0)
        tracker.update(1, HORIZONTAL, 0.0)
        tracker.update(1, HORIZONTAL, 2.0)
        normal = tracker.update(1, VERTICAL, 2.5)
        self.assertEqual(normal["status"], "normal")
        payload = tracker.update(1, HORIZONTAL, 3.0)
        self.assertEqual(payload["status"], "suspect")
        self.assertAlmostEqual(payload["seconds"], 0.0)

    def test_prune_keeps_active_and_recent_tracks(self):
        tracker = detector._FallTracker(ratio=1.05, grace=3.0)
        tracker.update(1, HORIZONTAL, 0.0)
        tracker.update(2, HORIZONTAL, 9.0)
        tracker.prune([1], now=10.0)
        self.assertIn("1", tracker.tracks)
        self.assertIn("2", tracker.tracks)

    def test_prune_respects_ttl(self):
        tracker = detector._FallTracker(ratio=1.05, grace=3.0)
        tracker.update(1, HORIZONTAL, 0.0)
        tracker.prune([], now=1.0)
        self.assertIn("1", tracker.tracks)
        tracker.prune([], now=detector.FALLS_TRACK_TTL + 0.5)
        self.assertNotIn("1", tracker.tracks)


class SummarizeFallsTest(unittest.TestCase):
    def test_counts_suspects_and_falls(self):
        payloads = [
            {"status": "normal"},
            {"status": "suspect"},
            {"status": "fallen"},
            {"status": "fallen"},
        ]
        summary = detector.summarize_falls(payloads)
        self.assertTrue(summary["enabled"])
        self.assertTrue(summary["available"])
        self.assertTrue(summary["heuristic"])
        self.assertEqual(summary["model"], "box-ratio")
        self.assertEqual(summary["persons"], 4)
        self.assertEqual(summary["suspects"], 3)
        self.assertEqual(summary["fallen"], 2)
        self.assertEqual(summary["ratioThreshold"], detector.FALLS_RATIO)
        self.assertEqual(summary["graceSeconds"], detector.FALLS_GRACE_SECONDS)

    def test_disabled_summary(self):
        with mock.patch.object(detector, "FALLS_ENABLED", False):
            summary = detector.summarize_falls([])
        self.assertFalse(summary["enabled"])
        self.assertFalse(summary["available"])
        self.assertEqual(summary["model"], "")
        self.assertEqual(summary["reason"], "disabled")

    def test_empty_summary_reports_custom_reason(self):
        summary = detector._empty_falls_summary(reason="detector-disabled")
        self.assertEqual(summary["persons"], 0)
        self.assertEqual(summary["reason"], "detector-disabled")
        self.assertIn("ratioThreshold", summary)
        self.assertIn("graceSeconds", summary)


if __name__ == "__main__":
    unittest.main()
