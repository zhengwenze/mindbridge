from __future__ import annotations

import json
import asyncio
from typing import Iterable

import httpx

from app.core.config import Settings
from app.core.enums import IntentType, RiskLevel
from app.schemas.dtos import AiMessage


BASE_MARKDOWN_OUTPUT_PROMPT = """
你必须使用 Markdown 输出最终回答。

格式要求：
1. 回答超过一个要点时，必须使用有序列表或无序列表。
2. 出现步骤、建议、原因、方案或注意事项时，必须使用列表组织。
3. 重要结论使用 **加粗**。
4. 需要划分主题时使用二级或三级标题。
5. 代码、命令、配置或日志使用 Markdown 代码块，并标注语言。
6. 需要引用用户原话或重要提醒时，可以使用 Markdown 引用块（>）。
7. 不要返回 HTML 标签，不要把整篇回答放入一个代码块。
8. 简短寒暄可以使用普通段落，不要为了 Markdown 而滥用标题。
9. 输出最终内容时，不要解释自己正在使用 Markdown。

格式示例（只展示格式，不要照抄内容）：
## 改善睡眠的建议

1. **固定作息时间**：每天尽量在相同时间入睡和起床。
2. **减少睡前刺激**：睡前一小时减少使用手机。
""".strip()


class PromptTemplates:
    @staticmethod
    def intent_prompt(history: list[AiMessage], user_input: str) -> list[AiMessage]:
        return [
            AiMessage(
                role="system",
                content=(
                    "你是一个用户意图分类器，只做意图识别，不回答问题。"
                    "只输出 CHAT、CONSULT、RISK 之一。CHAT 包含普通闲聊、学习、编程、作业、校园事务；"
                    "CONSULT 包含压力、焦虑、低落、失眠、情绪倾诉；RISK 包含自杀、自残、伤人或即时危险信号。"
                ),
            ),
            AiMessage(
                role="user",
                content=f"最近上下文：\n{format_history(history)}\n\n当前输入：\n{user_input}",
            ),
        ]

    @staticmethod
    def psychology_prompt(history: list[AiMessage], user_input: str) -> list[AiMessage]:
        return [
            AiMessage(
                role="system",
                content=(
                    "你负责分析校园心理健康消息。只返回严格 JSON："
                    '{"emotion":"NORMAL|ANXIETY|DEPRESSED|HIGH_RISK","emotionScore":0.0,'
                    '"risk":"LOW|MEDIUM|HIGH","confidence":0.0,"summary":"short reason"}'
                ),
            ),
            AiMessage(
                role="user",
                content=f"最近上下文：\n{format_history(history)}\n\n当前输入：\n{user_input}",
            ),
        ]

    @staticmethod
    def answer_system_prompt(
        intent: IntentType,
        risk: RiskLevel,
        context: str,
        display_name: str,
        skill_context: str = "",
    ) -> AiMessage:
        role_prompt = (
            (
                "你是 MindBridge，一个面向学生的日常陪伴与校园生活助手。"
                "普通学习、编程、校园事务和通用问题请自然、准确、直接地回答。"
                "不要主动做心理测评，不要输出风险等级、心理标签、诊断结论或报告口吻。"
                f"学生显示名：{display_name}"
            )
        )
        if intent != IntentType.CHAT:
            crisis_rule = ""
            if risk == RiskLevel.HIGH:
                crisis_rule = (
                    "\n高风险处理规则：先回应情绪，再关注当前安全；鼓励用户立刻联系身边可信任的人、"
                    "学校辅导员/心理中心或当地紧急救助；不提供任何危险操作细节。"
                )
            role_prompt = (
                "你是 MindBridge，一个面向学生的校园心理关怀智能体。"
                "回答要共情、谨慎、非评判，不诊断疾病，不开药，不替代持证心理咨询师。"
                "不要向学生输出风险等级、报告分数或后台标签。"
                "优先基于检索知识回答；知识不足时明确说明并给出安全通用建议。"
                f"\n学生显示名：{display_name}\n检索知识：\n{context}"
                f"\n\n可用 skill 指引：\n{skill_context or '无'}{crisis_rule}"
            )
        content = f"{role_prompt}\n\n{BASE_MARKDOWN_OUTPUT_PROMPT}"
        if intent != IntentType.CHAT:
            content += (
                "\n\n检索知识中的每个来源都带有稳定的 sourceId。引用事实时，只能引用提供的 sourceId，"
                "并在相关句子末尾使用精确格式【来源：source-1】；不要生成 Markdown 超链接或 URL，"
                "不要编造 sourceId、文件名或文档内容。"
            )
        return AiMessage(role="system", content=content)


class AiClient:
    def __init__(self, settings: Settings):
        self.settings = settings

    def complete(self, messages: list[AiMessage]) -> str:
        provider = self.settings.ai_provider.lower()
        if provider == "ollama":
            return self._ollama(messages, stream=False)
        if provider == "openai":
            return self._openai(messages, stream=False)
        return self._mock(messages)

    async def stream(self, messages: list[AiMessage]):
        provider = self.settings.ai_provider.lower()
        if provider == "ollama":
            async for token in self._ollama_stream(messages):
                yield token
            return
        if provider == "openai":
            async for token in self._openai_stream(messages):
                yield token
            return
        text = self._mock(messages)
        for chunk in split_text(text, 12):
            yield chunk
            # The mock provider is synchronous; a brief yield prevents all
            # development chunks from being coalesced into one browser update.
            await asyncio.sleep(0.015)

    def _ollama(self, messages: list[AiMessage], stream: bool) -> str:
        payload = {
            "model": self.settings.ollama_model,
            "messages": [m.model_dump() for m in messages],
            "stream": stream,
            "options": {
                "temperature": self.settings.ai_temperature,
                "num_predict": self.settings.ai_max_tokens,
            },
        }
        response = httpx.post(
            f"{self.settings.ollama_base_url}/api/chat", json=payload, timeout=60
        )
        response.raise_for_status()
        return response.json()["message"]["content"]

    async def _ollama_stream(self, messages: list[AiMessage]):
        payload = {
            "model": self.settings.ollama_model,
            "messages": [m.model_dump() for m in messages],
            "stream": True,
            "options": {
                "temperature": self.settings.ai_temperature,
                "num_predict": self.settings.ai_max_tokens,
            },
        }
        async with httpx.AsyncClient(timeout=60) as client:
            async with client.stream(
                "POST", f"{self.settings.ollama_base_url}/api/chat", json=payload
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    data = json.loads(line)
                    token = data.get("message", {}).get("content", "")
                    if token:
                        yield token

    def _openai(self, messages: list[AiMessage], stream: bool) -> str:
        headers = {"Authorization": f"Bearer {self.settings.openai_api_key}"}
        payload = {
            "model": self.settings.openai_model,
            "messages": [m.model_dump() for m in messages],
            "temperature": self.settings.ai_temperature,
            "max_tokens": self.settings.ai_max_tokens,
            "stream": stream,
        }
        response = httpx.post(
            f"{self.settings.openai_base_url}/chat/completions",
            headers=headers,
            json=payload,
            timeout=60,
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]

    async def _openai_stream(self, messages: list[AiMessage]):
        headers = {"Authorization": f"Bearer {self.settings.openai_api_key}"}
        payload = {
            "model": self.settings.openai_model,
            "messages": [m.model_dump() for m in messages],
            "temperature": self.settings.ai_temperature,
            "max_tokens": self.settings.ai_max_tokens,
            "stream": True,
        }
        async with httpx.AsyncClient(timeout=60) as client:
            async with client.stream(
                "POST",
                f"{self.settings.openai_base_url}/chat/completions",
                headers=headers,
                json=payload,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    raw = line.removeprefix("data: ").strip()
                    if raw == "[DONE]":
                        break
                    data = json.loads(raw)
                    token = data["choices"][0].get("delta", {}).get("content", "")
                    if token:
                        yield token

    def _mock(self, messages: list[AiMessage]) -> str:
        last = next((m.content for m in reversed(messages) if m.role == "user"), "")
        system = " ".join(m.content for m in messages if m.role == "system")
        if "严格 JSON" in system:
            if has_high_risk_signal(last):
                return '{"emotion":"HIGH_RISK","emotionScore":4.0,"risk":"HIGH","confidence":0.95,"summary":"检测到明确高风险表达"}'
            if has_consult_signal(last):
                return '{"emotion":"ANXIETY","emotionScore":2.5,"risk":"LOW","confidence":0.72,"summary":"检测到压力或情绪求助表达"}'
            return '{"emotion":"NORMAL","emotionScore":0.0,"risk":"LOW","confidence":0.66,"summary":"未检测到明显风险信号"}'
        if "意图分类器" in system:
            if has_high_risk_signal(last):
                return "RISK"
            if has_consult_signal(last):
                return "CONSULT"
            return "CHAT"
        if "high_risk_safety_plan" in system and has_high_risk_signal(last):
            return "## 现在先保障安全\n\n- **不要独自承受**：请马上联系身边可信任的人、辅导员或学校心理中心。\n- **先到安全的地方**：接下来 10 分钟，先去有人在的地方，并把可能伤害自己的东西移开。\n\n如果可以，请告诉我：你现在身边有没有可以马上联系的人？"
        if "当前由 CounselorAgent" in system:
            return "## 可以先做的事\n\n1. **列出最小步骤**：把今晚最担心的事情写下来，只选一个小步骤处理。\n2. **减少睡前刺激**：睡前 30 分钟把手机和学习任务放远，用缓慢呼吸帮助身体放松。\n\n> 如果失眠持续一周以上，建议联系学校心理中心或辅导员。"
        if "当前由 CompanionAgent" in system:
            return "## 我们可以这样开始\n\n- **先确定重点**：从你最想解决的部分开始。\n- **一步一步来**：不用一次处理所有问题。"
        if "KnowledgeAgent" in system and "SUFFICIENT" in system:
            return "SUFFICIENT"
        if "KnowledgeAgent" in system:
            return last[:40] or "校园心理支持"
        return "## 我们可以一步一步来\n\n请先告诉我你现在最具体的困扰。\n\n> 如果情况已经影响安全，请马上联系身边可信任的人或学校心理中心。"


def format_history(history: list[AiMessage]) -> str:
    if not history:
        return "无"
    return "\n".join(f"{m.role}: {m.content}" for m in history[-20:])


HIGH_RISK_WORDS = [
    "自杀",
    "自残",
    "不想活",
    "结束生命",
    "伤害自己",
    "轻生",
    "suicide",
    "kill myself",
    "self harm",
]
CONSULT_WORDS = [
    "焦虑",
    "抑郁",
    "压力",
    "失眠",
    "难过",
    "崩溃",
    "痛苦",
    "无助",
    "心理",
    "咨询",
    "anxious",
    "depress",
    "stress",
]


def has_high_risk_signal(text: str) -> bool:
    normalized = text.lower()
    return any(word in normalized for word in HIGH_RISK_WORDS)


def has_consult_signal(text: str) -> bool:
    normalized = text.lower()
    return any(word in normalized for word in CONSULT_WORDS)


def split_text(text: str, size: int) -> Iterable[str]:
    for index in range(0, len(text), size):
        yield text[index : index + size]
