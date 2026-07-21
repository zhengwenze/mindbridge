from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol


class RankedResult(Protocol):
    chunk_id: int | None
    source: str
    content: str
    score: float


def load_gold_dataset(path: Path) -> list[dict[str, Any]]:
    cases = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(cases, list) or not cases:
        raise ValueError("金标数据集必须是非空 JSON 数组")
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
        if not str(case.get("question", "")).strip():
            raise ValueError(f"样本 {case_id} 缺少 question")
        relevant = case.get("relevantItems")
        if not isinstance(relevant, list) or not relevant:
            raise ValueError(f"样本 {case_id} 没有人工相关项；负样本应在路由评测中处理")
        for item in relevant:
            if not str(item.get("source", "")).strip() or not str(item.get("locator", "")).strip():
                raise ValueError(f"样本 {case_id} 的相关项缺少 source 或 locator")
    return cases


def evaluate_ranked_case(case: dict[str, Any], retrieved: list[RankedResult], top_k: int) -> dict[str, Any]:
    qrels = {
        (str(item["source"]).casefold(), str(item["locator"]).casefold())
        for item in case["relevantItems"]
    }
    covered: set[tuple[str, str]] = set()
    first_relevant_rank = 0
    ranked_items: list[dict[str, Any]] = []

    for rank, result in enumerate(retrieved[:top_k], start=1):
        content = result.content.casefold()
        matched = sorted(
            locator
            for source, locator in qrels
            if source == result.source.casefold() and locator in content
        )
        if matched and first_relevant_rank == 0:
            first_relevant_rank = rank
        covered.update((result.source.casefold(), locator) for locator in matched)
        ranked_items.append(
            {
                "rank": rank,
                "chunkId": result.chunk_id,
                "source": result.source,
                "score": result.score,
                "matchedLocators": matched,
                "preview": " ".join(result.content.split())[:240],
            }
        )

    recall = len(covered) / len(qrels)
    reciprocal_rank = 1.0 / first_relevant_rank if first_relevant_rank else 0.0
    hit = 1.0 if first_relevant_rank else 0.0
    return {
        "id": case["id"],
        "question": case["question"],
        "relevantItems": case["relevantItems"],
        "retrieved": ranked_items,
        "coveredRelevantItems": [
            {"source": source, "locator": locator} for source, locator in sorted(covered)
        ],
        "recallAtK": recall,
        "reciprocalRankAtK": reciprocal_rank,
        "hitAtK": hit,
        "firstRelevantRank": first_relevant_rank,
    }


def summarize(results: list[dict[str, Any]], top_k: int) -> dict[str, Any]:
    total = len(results)
    if total == 0:
        raise ValueError("没有可汇总的人工金标样本")
    return {
        "totalCases": total,
        "topK": top_k,
        "recallAtK": sum(item["recallAtK"] for item in results) / total,
        "mrrAtK": sum(item["reciprocalRankAtK"] for item in results) / total,
        "hitRateAtK": sum(item["hitAtK"] for item in results) / total,
    }


def evaluate(dataset: Path, output: Path, top_k: int, require_hybrid: bool) -> dict[str, Any]:
    # Keep database/vector dependencies out of module import so the metric
    # formulas remain unit-testable without a live MySQL environment.
    from app.core.bootstrap import create_schema, seed_data
    from app.core.config import get_settings
    from app.core.database import SessionLocal
    from app.services.knowledge import KnowledgeService

    settings = get_settings()
    create_schema()
    db = SessionLocal()
    try:
        seed_data(db)
        service = KnowledgeService(db, settings)
        if require_hybrid and not (
            settings.knowledge_vector_enabled
            and settings.knowledge_vector_required
            and service.vector_store.can_embed
        ):
            raise RuntimeError(
                "主指标要求真实 Hybrid：请启用并强制向量检索，且确认 Chroma/Embedding 可用"
            )
        cases = load_gold_dataset(dataset)
        results = [
            evaluate_ranked_case(case, service.retrieve(case["question"], top_k), top_k)
            for case in cases
        ]
        report = {
            "createdAt": datetime.now(UTC).isoformat(),
            "dataset": str(dataset),
            "configuration": {
                "embeddingModel": settings.embedding_model,
                "knowledgeVectorEnabled": settings.knowledge_vector_enabled,
                "knowledgeVectorRequired": settings.knowledge_vector_required,
                "vectorAvailable": service.vector_store.can_embed,
                "candidateK": settings.knowledge_candidate_k,
                "vectorWeight": settings.knowledge_hybrid_vector_weight,
                "bm25Weight": settings.knowledge_hybrid_bm25_weight,
                "rerankEnabled": settings.knowledge_rerank_enabled,
            },
            "metrics": summarize(results, top_k),
            "results": results,
        }
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        return report
    finally:
        db.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="MindBridge 人工金标 RAG 评测")
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--top-k", type=int, default=4)
    parser.add_argument("--require-hybrid", action="store_true")
    args = parser.parse_args()
    if args.top_k <= 0:
        parser.error("--top-k 必须大于 0")
    return args


if __name__ == "__main__":
    arguments = parse_args()
    generated = evaluate(
        arguments.dataset,
        arguments.output,
        arguments.top_k,
        arguments.require_hybrid,
    )
    print(json.dumps(generated["metrics"], ensure_ascii=False, indent=2))
