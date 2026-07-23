import json
import tempfile
import unittest
from pathlib import Path

from app.rag_eval.negative_runner import load_negative_dataset


class RagNegativeDatasetTests(unittest.TestCase):
    def test_loads_approved_non_retrieval_case(self):
        cases = [
            {
                "id": "negative-1",
                "question": "今天天气怎么样？",
                "annotationStatus": "APPROVED",
                "reviewer": "human-a",
                "shouldRetrieve": False,
            }
        ]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "negative.json"
            path.write_text(json.dumps(cases, ensure_ascii=False), encoding="utf-8")
            self.assertEqual(load_negative_dataset(path), cases)

    def test_rejects_case_that_should_retrieve(self):
        cases = [
            {
                "id": "not-negative",
                "question": "如何预约心理咨询？",
                "annotationStatus": "APPROVED",
                "reviewer": "human-a",
                "shouldRetrieve": True,
            }
        ]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "negative.json"
            path.write_text(json.dumps(cases, ensure_ascii=False), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "不是“不应检索”的负样本"):
                load_negative_dataset(path)


if __name__ == "__main__":
    unittest.main()
