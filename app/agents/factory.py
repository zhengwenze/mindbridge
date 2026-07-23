from __future__ import annotations
from importlib.util import find_spec
from sqlalchemy.orm import Session
from app.agents.runtime import AgentRuntimeService
from app.core.config import Settings, get_agent_framework


def create_agent_runtime(db: Session, settings: Settings) -> AgentRuntimeService:
    """
    根据系统配置选择并创建对应的 Agent Runtime。

    支持三种模式：
    1. 事件驱动多智能体 Runtime；
    2. LangGraph Runtime；
    3. 基础 Runtime，作为默认兜底实现。

    该函数属于工厂函数，负责封装 Runtime 的选择和实例化逻辑，
    使上层业务无需关心具体使用哪一种 Runtime 实现。
    """
    framework = get_agent_framework(settings)
    if framework == "event_driven_multi_agent":
        from app.agents.event_driven_runtime import EventDrivenAgentRuntimeService

        return EventDrivenAgentRuntimeService(db, settings)
    if framework == "langgraph" and langgraph_available():
        from app.agents.langgraph_runtime import LangGraphAgentRuntimeService

        return LangGraphAgentRuntimeService(db, settings)
    return AgentRuntimeService(db, settings)


def agent_framework_status(settings: Settings) -> dict:
    """
    获取 Agent 框架的配置状态和实际运行状态。

    该函数会区分：
    - requested：配置文件中请求使用的框架；
    - active：系统实际启用的框架；
    - langgraphAvailable：当前环境是否安装 LangGraph；
    - fallback：是否发生了框架降级。

    Returns:
        包含请求框架、实际框架、依赖状态和降级状态的字典。
    """
    requested = get_agent_framework(settings)
    available = langgraph_available()
    if requested == "event_driven_multi_agent":
        active = "event_driven_multi_agent"
    elif requested == "langgraph" and available:
        active = "langgraph"
    else:
        active = "custom"
    return {
        "requested": requested,
        "active": active,
        "langgraphAvailable": available,
        "fallback": active != requested,
    }


def wants_event_driven(settings: Settings) -> bool:
    return get_agent_framework(settings) == "event_driven_multi_agent"


def wants_langgraph(settings: Settings) -> bool:
    return get_agent_framework(settings) == "langgraph"


def langgraph_available() -> bool:
    return find_spec("langgraph") is not None
