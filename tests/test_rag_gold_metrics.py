import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from app.rag_eval.gold_runner import evaluate_ranked_case, load_gold_dataset, summarize


def result(source: str, content: str, score: float = 1.0):
    return SimpleNamespace(chunk_id=1, source=source, content=content, score=score)


def approved_case():
    return {
        "id": "case-1",
        "question": "测试问题",
        "annotationStatus": "APPROVED",
        "reviewer": "human-a",
        "relevantItems": [
            {"source": "policy.md", "locator": "LOCATOR-A", "relevance": 2},
            {"source": "policy.md", "locator": "LOCATOR-B", "relevance": 1},
            {"source": "other.md", "locator": "LOCATOR-C", "relevance": 1},
        ],
    }


class RagGoldMetricTests(unittest.TestCase):
    def test_recall_mrr_and_hit_rate_are_computed_independently(self):
        ranked = [
            result("noise.md", "无关内容"),
            result("policy.md", "包含 locator-b 的相关内容"),
            result("noise.md", "仍然无关"),
            result("noise.md", "还是无关"),
        ]

        evaluated = evaluate_ranked_case(approved_case(), ranked, top_k=4)

        self.assertAlmostEqual(evaluated["recallAtK"], 1 / 3)
        self.assertAlmostEqual(evaluated["reciprocalRankAtK"], 1 / 2)
        self.assertEqual(evaluated["hitAtK"], 1.0)
        self.assertEqual(evaluated["firstRelevantRank"], 2)

    def test_no_relevant_result_produces_zero_metrics(self):
        evaluated = evaluate_ranked_case(
            approved_case(), [result("noise.md", "无关内容")], top_k=4
        )

        self.assertEqual(evaluated["recallAtK"], 0.0)
        self.assertEqual(evaluated["reciprocalRankAtK"], 0.0)
        self.assertEqual(evaluated["hitAtK"], 0.0)

    def test_summary_is_macro_average(self):
        metrics = summarize(
            [
                {"recallAtK": 1.0, "reciprocalRankAtK": 1.0, "hitAtK": 1.0},
                {"recallAtK": 0.5, "reciprocalRankAtK": 0.25, "hitAtK": 1.0},
                {"recallAtK": 0.0, "reciprocalRankAtK": 0.0, "hitAtK": 0.0},
            ],
            top_k=4,
        )

        self.assertEqual(metrics["totalCases"], 3)
        self.assertEqual(metrics["topK"], 4)
        self.assertAlmostEqual(metrics["recallAtK"], 0.5)
        self.assertAlmostEqual(metrics["mrrAtK"], 5 / 12)
        self.assertAlmostEqual(metrics["hitRateAtK"], 2 / 3)

    def test_dataset_rejects_model_draft_without_human_approval(self):
        case = approved_case()
        case["annotationStatus"] = "PENDING"
        with tempfile.TemporaryDirectory() as directory:
            dataset = Path(directory) / "draft.json"
            dataset.write_text(json.dumps([case], ensure_ascii=False), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "人工 APPROVED"):
                load_gold_dataset(dataset)


if __name__ == "__main__":
    unittest.main()
