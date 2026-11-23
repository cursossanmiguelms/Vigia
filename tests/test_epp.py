"""Pruebas del detector EPP sin cargar torch ni ultralytics.

Se ejecutan con:

    python -m unittest tests.test_epp -v
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import detector  # noqa: E402


def item(label, x1, y1, x2, y2, confidence=0.9):
    return {
        "label": label,
        "x1": x1,
        "y1": y1,
        "x2": x2,
        "y2": y2,
        "confidence": confidence,
    }


PERSON = {"x1": 0, "y1": 0, "x2": 100, "y2": 200}


class ResolveClassesTest(unittest.TestCase):
    def test_aliases_in_dict(self):
        names = {0: "person", 1: "hardhat", 2: "safety_vest", 3: "sin_casco"}
        self.assertEqual(
            detector.resolve_epp_classes(names),
            {"person": 0, "helmet": 1, "vest": 2, "no_helmet": 3},
        )

    def test_aliases_in_list_and_case(self):
        names = ["Person", "Helmet", "Reflective-Vest", "no-vest"]
        resolved = detector.resolve_epp_classes(names)
        self.assertEqual(resolved["person"], 0)
        self.assertEqual(resolved["helmet"], 1)
        self.assertEqual(resolved["vest"], 2)
        self.assertEqual(resolved["no_vest"], 3)

    def test_first_alias_wins(self):
        names = {0: "helmet", 1: "hard_hat"}
        self.assertEqual(detector.resolve_epp_classes(names)["helmet"], 0)


class AssociateEppTest(unittest.TestCase):
    def test_associates_helmet_and_vest(self):
        result = detector.associate_epp(
            PERSON,
            [
                item("helmet", 20, 5, 60, 40),
                item("vest", 10, 60, 90, 140),
                item("person", 0, 0, 100, 200),
            ],
        )
        self.assertIn("helmet", result)
        self.assertIn("vest", result)
        self.assertNotIn("person", result)
        self.assertEqual(result["helmet"]["x1"], 20.0)

    def test_rejects_helmet_below_top_45_percent(self):
        result = detector.associate_epp(
            PERSON, [item("helmet", 30, 100, 70, 140)]
        )
        self.assertNotIn("helmet", result)

    def test_rejects_vest_outside_torso_range(self):
        result = detector.associate_epp(
            PERSON,
            [
                item("vest", 10, 0, 90, 20),
                item("vest", 10, 175, 90, 199),
            ],
        )
        self.assertNotIn("vest", result)

    def test_rejects_item_outside_person(self):
        result = detector.associate_epp(
            PERSON, [item("helmet", 150, 5, 190, 40)]
        )
        self.assertNotIn("helmet", result)

    def test_picks_highest_scored_candidate(self):
        result = detector.associate_epp(
            PERSON,
            [
                item("helmet", 15, 5, 55, 40, confidence=0.35),
                item("helmet", 30, 5, 70, 40, confidence=0.92),
            ],
        )
        self.assertEqual(result["helmet"]["confidence"], 0.92)

    def test_keeps_negative_classes(self):
        result = detector.associate_epp(
            PERSON, [item("no_helmet", 30, 10, 70, 45)]
        )
        self.assertIn("no_helmet", result)


class ObservationTest(unittest.TestCase):
    def test_negative_wins_at_equal_or_higher_confidence(self):
        association = {
            "helmet": item("helmet", 0, 0, 10, 10, confidence=0.6),
            "no_helmet": item("no_helmet", 0, 0, 10, 10, confidence=0.7),
        }
        self.assertEqual(
            detector._epp_observation(association, "helmet"), (False, 0.7)
        )

    def test_positive_wins_with_higher_confidence(self):
        association = {
            "vest": item("vest", 0, 0, 10, 10, confidence=0.8),
            "no_vest": item("no_vest", 0, 0, 10, 10, confidence=0.4),
        }
        self.assertEqual(
            detector._epp_observation(association, "vest"), (True, 0.8)
        )

    def test_unknown_when_no_detection(self):
        self.assertEqual(detector._epp_observation({}, "helmet"), (None, 0.0))


class PayloadTest(unittest.TestCase):
    def test_status_ok(self):
        payload = detector._epp_payload(True, True, 0.9, 0.8)
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["missing"], [])
        self.assertFalse(payload["simulation"])

    def test_status_missing(self):
        payload = detector._epp_payload(True, False, 0.9, 0.0)
        self.assertEqual(payload["status"], "missing")
        self.assertEqual(payload["missing"], ["vest"])

    def test_status_partial_with_single_item(self):
        payload = detector._epp_payload(None, True, 0.0, 0.8)
        self.assertEqual(payload["status"], "partial")
        self.assertIsNone(payload["helmet"])

    def test_status_unknown(self):
        payload = detector._epp_payload(None, None)
        self.assertEqual(payload["status"], "unknown")

    def test_includes_absolute_boxes(self):
        association = {
            "helmet": item("helmet", 20, 5, 60, 40, confidence=0.88)
        }
        payload = detector._epp_payload(True, None, 0.88, 0.0, association)
        self.assertIn("helmet", payload["boxes"])
        self.assertEqual(payload["boxes"]["helmet"]["confidence"], 0.88)
        self.assertNotIn("vest", payload["boxes"])


class NormalizeBoxesTest(unittest.TestCase):
    def test_round_trip(self):
        person = {"x1": 100, "y1": 200, "x2": 200, "y2": 600}
        association = {
            "helmet": item("helmet", 110, 210, 150, 250, confidence=0.75),
            "vest": item("vest", 105, 300, 195, 500, confidence=0.8),
        }
        normalized = detector._epp_normalize_boxes(association, person)
        self.assertAlmostEqual(normalized["helmet"]["x1"], 0.1)
        self.assertAlmostEqual(normalized["helmet"]["y1"], 0.025)
        self.assertAlmostEqual(normalized["helmet"]["x2"], 0.5)
        self.assertAlmostEqual(normalized["helmet"]["y2"], 0.125)

        restored = detector._epp_restore_boxes(normalized, person)
        self.assertEqual(restored["helmet"]["x1"], 110.0)
        self.assertEqual(restored["helmet"]["y1"], 210.0)
        self.assertEqual(restored["helmet"]["x2"], 150.0)
        self.assertEqual(restored["helmet"]["y2"], 250.0)
        self.assertEqual(restored["vest"]["confidence"], 0.8)

    def test_ignores_unknown_labels(self):
        person = {"x1": 0, "y1": 0, "x2": 100, "y2": 100}
        normalized = detector._epp_normalize_boxes(
            {"person": item("person", 0, 0, 50, 50)}, person
        )
        self.assertEqual(normalized, {})


class SmootherTest(unittest.TestCase):
    def fill(self, smoother, helmet, vest, times=7):
        payload = None
        for _ in range(times):
            payload = smoother.update(1, helmet, vest)
        return payload

    def test_confirms_presence(self):
        smoother = detector._EppSmoother()
        payload = self.fill(smoother, True, True)
        self.assertTrue(payload["helmet"])
        self.assertTrue(payload["vest"])
        self.assertEqual(payload["status"], "ok")

    def test_absence_needs_three_observations(self):
        smoother = detector._EppSmoother()
        self.fill(smoother, True, True)
        first = smoother.update(1, False, False)
        second = smoother.update(1, False, False)
        third = smoother.update(1, False, False)
        self.assertTrue(first["helmet"])
        self.assertTrue(second["helmet"])
        self.assertFalse(third["helmet"])
        self.assertEqual(third["status"], "missing")

    def test_presence_needs_window_majority(self):
        smoother = detector._EppSmoother()
        self.fill(smoother, False, False)
        payload = None
        for _ in range(4):
            payload = smoother.update(1, True, True)
        self.assertFalse(payload["helmet"])
        payload = smoother.update(1, True, True)
        self.assertTrue(payload["helmet"])

    def test_unknown_keeps_previous_state(self):
        smoother = detector._EppSmoother()
        self.fill(smoother, True, True)
        payload = smoother.update(1, None, None)
        self.assertTrue(payload["helmet"])
        self.assertTrue(payload["vest"])

    def test_prune_drops_inactive_tracks(self):
        smoother = detector._EppSmoother()
        smoother.update(1, True, True)
        smoother.update(2, True, True)
        smoother.prune([1])
        self.assertIn("1", smoother.history)
        self.assertNotIn("2", smoother.history)


class SummarizeTest(unittest.TestCase):
    def test_counts_and_compliance(self):
        payloads = [
            detector._epp_payload(True, True),
            detector._epp_payload(False, True),
            detector._epp_payload(True, None),
            detector._epp_payload(None, None),
        ]
        summary = detector.summarize_epp(payloads, model="epp_yolo11n.pt")
        self.assertTrue(summary["enabled"])
        self.assertTrue(summary["available"])
        self.assertEqual(summary["model"], "epp_yolo11n.pt")
        self.assertEqual(summary["persons"], 4)
        self.assertEqual(summary["compliant"], 1)
        self.assertEqual(summary["nonCompliant"], 1)
        self.assertEqual(summary["unknown"], 2)
        self.assertEqual(summary["withHelmet"], 2)
        self.assertEqual(summary["withoutHelmet"], 1)
        self.assertEqual(summary["withVest"], 2)
        self.assertEqual(summary["withoutVest"], 0)
        self.assertEqual(summary["compliance"], 50.0)

    def test_partial_counts_as_unknown(self):
        payload = detector._epp_payload(True, None)
        summary = detector.summarize_epp([payload], model="epp.pt")
        self.assertEqual(summary["unknown"], 1)
        self.assertEqual(summary["compliant"], 0)
        self.assertIsNone(summary["compliance"])

    def test_no_model_reports_reason(self):
        summary = detector.summarize_epp([], reason="model-missing")
        self.assertFalse(summary["enabled"])
        self.assertFalse(summary["available"])
        self.assertEqual(summary["reason"], "model-missing")
        self.assertIsNone(summary["compliance"])


if __name__ == "__main__":
    unittest.main()
