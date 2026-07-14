import json
import unittest
from types import SimpleNamespace

from app.core.enums import IntentType, RiskLevel
from app.schemas.dtos import AiMessage, ChatStreamEvent
from app.services.ai import AiClient, BASE_MARKDOWN_OUTPUT_PROMPT, PromptTemplates
from app.services.chat import sse


class MarkdownOutputTests(unittest.TestCase):
    def test_markdown_protocol_is_present_for_all_answer_intents(self):
        for intent in IntentType:
            prompt = PromptTemplates.answer_system_prompt(intent, RiskLevel.LOW, "", "学生").content
            self.assertIn(BASE_MARKDOWN_OUTPUT_PROMPT, prompt)
            self.assertIn("必须使用 Markdown", prompt)
            self.assertIn("**固定作息时间**", prompt)

    def test_mock_answer_contains_real_markdown_structure(self):
        client = AiClient(SimpleNamespace(ai_provider="mock"))
        answer = client._mock([
            AiMessage(role="system", content="当前由 CounselorAgent 负责回复。\n必须使用 Markdown"),
            AiMessage(role="user", content="我最近压力很大"),
        ])
        self.assertIn("## ", answer)
        self.assertIn("1. ", answer)
        self.assertIn("**", answer)
        self.assertIn(">", answer)

    def test_sse_preserves_markdown_characters_and_newlines(self):
        payload = ChatStreamEvent(type="token", content="## 标题\n\n- **重点**\n\n```python\nprint('ok')\n```").model_dump()
        event = sse("token", payload)
        data = json.loads(event.split("data: ", 1)[1].split("\n", 1)[0])
        self.assertEqual(data["content"], payload["content"])
