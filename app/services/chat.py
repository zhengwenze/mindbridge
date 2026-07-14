from __future__ import annotations

import json
import logging
import re

from sqlalchemy.orm import Session

from app.agents.harness import MindBridgeAgentHarness
from app.core.config import Settings
from app.models.entities import UserAccount
from app.schemas.dtos import ChatRequest, ChatStreamEvent
from app.services.ai import AiClient


logger = logging.getLogger(__name__)


class ChatService:
    def __init__(self, db: Session, settings: Settings):
        self.db = db
        self.settings = settings
        self.ai = AiClient(settings)
        self.agent_harness = MindBridgeAgentHarness(db, settings)

    async def stream_chat(self, user: UserAccount, request: ChatRequest):
        # Establish the SSE response before synchronous orchestration begins so
        # proxy layers do not wait to buffer the first model token.
        yield ": stream-start\n\n"
        outcome = self.agent_harness.run(user, request)
        yield sse("meta", ChatStreamEvent(type="meta", sessionId=outcome.session.public_id).model_dump(by_alias=True))
        source_catalog = source_metadata(outcome.retrieved_knowledge)
        if source_catalog:
            yield sse("sources", ChatStreamEvent(
                type="sources", sessionId=outcome.session.public_id, sources=source_catalog
            ).model_dump(by_alias=True))
        assistant = []
        async for token in self.ai.stream(outcome.response_messages):
            assistant.append(token)
            yield sse("token", ChatStreamEvent(type="token", sessionId=outcome.session.public_id, content=token).model_dump())
        if assistant:
            raw_content = "".join(assistant)
            normalized_content, cited_sources = normalize_citations(raw_content, source_catalog)
            self.agent_harness.save_assistant_message(user, outcome.session, normalized_content)
            if cited_sources:
                yield sse("sources", ChatStreamEvent(
                    type="sources", sessionId=outcome.session.public_id, sources=cited_sources
                ).model_dump(by_alias=True))
        try:
            await self.agent_harness.dispatch_tools(outcome.tool_plan)
        except Exception as exc:
            logger.warning(
                "Post-response tool dispatch failed for session=%s report_id=%s: %s",
                outcome.session.public_id,
                outcome.report_id,
                exc,
                exc_info=True,
            )
        yield sse("done", ChatStreamEvent(type="done", sessionId=outcome.session.public_id).model_dump())


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


def source_metadata(results) -> list[dict]:
    sources = []
    seen = set()
    for index, result in enumerate(results, start=1):
        if result.document_id is None or result.knowledge_base_id is None:
            continue
        source_id = f"source-{index}"
        if source_id in seen:
            continue
        seen.add(source_id)
        sources.append({
            "sourceId": source_id,
            "documentId": result.document_id,
            "knowledgeBaseId": result.knowledge_base_id,
            "fileName": result.document_name or result.source,
            "chunkId": result.chunk_id,
            "snippet": result.content[:800],
        })
    return sources


def normalize_citations(content: str, sources: list[dict]) -> tuple[str, list[dict]]:
    by_id = {item["sourceId"]: item for item in sources}
    cited_ids: list[str] = []

    def replace(match: re.Match[str]) -> str:
        source_id = match.group(1).strip()
        source = by_id.get(source_id)
        if source is None:
            return match.group(0)
        if source_id not in cited_ids:
            cited_ids.append(source_id)
        return f"【来源：{source['fileName']}】"

    normalized = re.sub(r"【来源：\s*(source-\d+)\s*】", replace, content)
    return normalized, [by_id[item] for item in cited_ids]
