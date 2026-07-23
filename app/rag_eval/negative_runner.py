from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


def load_negative_dataset(path: Path) -> list[dict[str, Any]]:
    cases = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(cases, list) or not cases:
        raise ValueError("负样本数据集必须是非空 JSON 数组")
    seen_ids: set[str] = set()
    for case in cases:
        case_id = str(case.get("id", "")).strip()
        if not case_id or case_id in seen_ids:
            raise ValueError(f"样本 id 为空或重复: {case_id!r}")
        seen_ids.add(case_id)
        if case.get("annotationStatus") != "APPROVED":
            raise ValueError(f"样本 {case_id} 尚未完成人工 APPROVED")
        if not str(case.get("reviewer", "")).strip():
            raise ValueError(f"样本 {case_id} 缺少人工 reviewer")
        if case.get("shouldRetrieve") is not False:
            raise ValueError(f"样本 {case_id} 不是“不应检索”的负样本")
        if not str(case.get("question", "")).strip():
            raise ValueError(f"样本 {case_id} 缺少 question")
    return cases


def evaluate(dataset: Path, output: Path) -> dict[str, Any]:
    # Keep runtime/database imports out of module import so dataset validation
    # remains unit-testable without live infrastructure.
    from app.agents.factory import agent_framework_status
    from app.agents.runtime import AgentRuntimeService
    from app.core.config import get_settings
    from app.core.database import SessionLocal
    from app.core.enums import IntentType

    settings = get_settings()
    cases = load_negative_dataset(dataset)
    db = SessionLocal()
    try:
        runtime = AgentRuntimeService(db, settings)
        results = []
        for case in cases:
            intent = runtime._classify(case["question"], [])
            predicted_retrieval = intent != IntentType.CHAT
            results.append(
                {
                    "id": case["id"],
                    "question": case["question"],
                    "expectedShouldRetrieve": False,
                    "predictedIntent": intent.value,
                    "predictedShouldRetrieve": predicted_retrieval,
                    "falseRetrieval": predicted_retrieval,
                }
            )
        false_retrievals = sum(item["falseRetrieval"] for item in results)
        total = len(results)
        report = {
            "createdAt": datetime.now(UTC).isoformat(),
            "dataset": str(dataset),
            "configuration": {
                "aiProvider": settings.ai_provider,
                "model": (
                    settings.ollama_model
                    if settings.ai_provider.lower() == "ollama"
                    else settings.openai_model
                ),
                "agentFramework": agent_framework_status(settings),
                "routingRule": "CHAT skips KnowledgeAgent; CONSULT/RISK retrieves",
            },
            "metrics": {
                "totalCases": total,
                "falseRetrievalCount": false_retrievals,
                "falseRetrievalRate": false_retrievals / total,
                "routingAccuracy": (total - false_retrievals) / total,
            },
            "results": results,
        }
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(
            json.dumps(report, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return report
    finally:
        db.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="MindBridge RAG 负样本路由评测")
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    generated = evaluate(arguments.dataset, arguments.output)
    print(json.dumps(generated["metrics"], ensure_ascii=False, indent=2))
