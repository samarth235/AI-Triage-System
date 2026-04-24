import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from utils.nlp_parser import parse_complaint
from utils.sepsis import check_sepsis_risk


class ParserTests(unittest.TestCase):
    def test_parse_complaint_detects_chest_pain_keywords(self):
        result = parse_complaint("Severe chest pain radiating to the left arm")
        self.assertEqual(result["category_id"], 0)
        self.assertEqual(result["urgency_hint"], "medium")

    def test_parse_complaint_falls_back_with_low_signal_text(self):
        result = parse_complaint("general discomfort")
        self.assertTrue(result["fallback"])
        self.assertGreaterEqual(result["confidence"], 30)


class SepsisTests(unittest.TestCase):
    def test_sepsis_high_risk_when_multiple_criteria_met(self):
        result = check_sepsis_risk(
            {
                "temperature": 39.1,
                "heart_rate": 122,
                "respiratory_rate": 28,
                "conscious_level": 1,
                "oxygen_saturation": 95,
                "systolic_bp": 104,
            }
        )
        self.assertTrue(result["flag"])
        self.assertEqual(result["risk_level"], "high")

    def test_sepsis_none_when_vitals_are_stable(self):
        result = check_sepsis_risk(
            {
                "temperature": 37.0,
                "heart_rate": 78,
                "respiratory_rate": 16,
                "conscious_level": 0,
                "oxygen_saturation": 98,
                "systolic_bp": 120,
            }
        )
        self.assertFalse(result["flag"])
        self.assertEqual(result["risk_level"], "none")


if __name__ == "__main__":
    unittest.main()
