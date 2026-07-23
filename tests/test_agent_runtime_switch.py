import base64
import json
import os
import time
import unittest
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import HTTPException

from app.agents.factory import create_agent_runtime
from app.agents.runtime import AgentRuntimeService
from app.api.routes import update_admin_agent_runtime
from app.core.config import (
    Settings,
    get_agent_framework,
    get_settings,
    set_agent_framework,
)
from app.schemas.dtos import AgentRuntimeUpdateRequest


BASE_URL = os.environ.get("MINDBRIDGE_BASE_URL", "http://127.0.0.1:8000").rstrip("/")


def request_json(
    path: str,
    method: str = "GET",
    payload: dict | None = None,
    headers: dict | None = None,
) -> tuple[int, dict]:
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = Request(
        f"{BASE_URL}{path}",
        data=body,
        method=method,
        headers={
            "Accept": "application/json",
            **({"Content-Type": "application/json"} if payload is not None else {}),
            **(headers or {}),
        },
    )
    try:
        with urlopen(request, timeout=10) as response:
            raw = response.read().decode("utf-8")
            return response.status, json.loads(raw) if raw else {}
    except HTTPError as exc:
        raw = exc.read().decode("utf-8")
        return exc.code, json.loads(raw) if raw else {}


def basic_auth(username: str, password: str) -> dict[str, str]:
    token = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("utf-8")
    return {"Authorization": f"Basic {token}"}


class AgentRuntimeConfigurationTests(unittest.TestCase):
    def test_python_default_is_langgraph_and_environment_can_override_it(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(Settings(_env_file=None).agent_framework, "langgraph")
        with patch.dict(
            os.environ,
            {"AGENT_FRAMEWORK": "event_driven_multi_agent"},
            clear=True,
        ):
            self.assertEqual(
                Settings(_env_file=None).agent_framework,
                "event_driven_multi_agent",
            )

    def test_process_local_selection_is_normalized_and_mutable(self):
        settings = Settings(agent_framework="multi_agent", _env_file=None)

        self.assertEqual(get_agent_framework(settings), "event_driven_multi_agent")
        self.assertEqual(set_agent_framework(settings, "CUSTOM"), "custom")
        self.assertEqual(get_agent_framework(settings), "custom")

        with self.assertRaises(ValueError):
            set_agent_framework(settings, "unsupported")
        self.assertEqual(get_agent_framework(settings), "custom")

    def test_recreating_cached_settings_restores_the_startup_selection(self):
        try:
            with patch.dict(
                os.environ,
                {"AGENT_FRAMEWORK": "event_driven_multi_agent"},
                clear=False,
            ):
                get_settings.cache_clear()
                settings = get_settings()
                set_agent_framework(settings, "custom")
                self.assertEqual(get_agent_framework(get_settings()), "custom")

                get_settings.cache_clear()
                self.assertEqual(
                    get_agent_framework(get_settings()),
                    "event_driven_multi_agent",
                )
        finally:
            get_settings.cache_clear()

    def test_runtime_factory_snapshots_framework_once_per_creation(self):
        settings = Settings(
            agent_framework="event_driven_multi_agent",
            ai_provider="mock",
            _env_file=None,
        )
        from app.agents.event_driven_runtime import EventDrivenAgentRuntimeService

        with (
            patch(
                "app.agents.factory.get_agent_framework",
                return_value="event_driven_multi_agent",
            ) as current_framework,
            patch.object(
                EventDrivenAgentRuntimeService,
                "__init__",
                return_value=None,
            ),
        ):
            runtime = create_agent_runtime(MagicMock(), settings)

        self.assertIsInstance(runtime, EventDrivenAgentRuntimeService)
        current_framework.assert_called_once_with(settings)

    def test_custom_selection_creates_the_base_runtime(self):
        settings = Settings(
            agent_framework="custom",
            ai_provider="mock",
            _env_file=None,
        )

        runtime = create_agent_runtime(MagicMock(), settings)

        self.assertIs(type(runtime), AgentRuntimeService)

    def test_unavailable_langgraph_is_rejected_without_changing_selection(self):
        settings = Settings(
            agent_framework="custom",
            ai_provider="mock",
            _env_file=None,
        )
        unavailable = {
            "requested": "custom",
            "active": "custom",
            "langgraphAvailable": False,
            "fallback": False,
        }

        with (
            patch("app.api.routes.get_settings", return_value=settings),
            patch("app.api.routes.agent_framework_status", return_value=unavailable),
            self.assertRaises(HTTPException) as raised,
        ):
            update_admin_agent_runtime(
                AgentRuntimeUpdateRequest(framework="langgraph"),
                MagicMock(),
            )

        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(get_agent_framework(settings), "custom")


class AgentRuntimeSwitchDockerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        deadline = time.time() + 60
        last_error: Exception | None = None
        while time.time() < deadline:
            try:
                status, body = request_json("/actuator/health")
                if status == 200 and body.get("status") == "UP":
                    return
            except (URLError, TimeoutError) as exc:
                last_error = exc
            time.sleep(2)
        raise RuntimeError(
            f"MindBridge Docker app is not reachable at {BASE_URL}. "
            "Run `docker compose up -d --build` first."
        ) from last_error

    def test_admin_can_switch_all_available_runtimes_and_status_stays_in_sync(self):
        admin = basic_auth("admin", "000000")
        status, initial = request_json("/api/admin/agent-runtime", headers=admin)
        self.assertEqual(status, 200, initial)
        original = initial["currentFramework"]
        self.assertEqual(initial["defaultFramework"], "langgraph")
        self.assertEqual(initial["persistence"], "process")
        self.assertEqual(
            {option["value"] for option in initial["options"]},
            {"event_driven_multi_agent", "langgraph", "custom"},
        )

        available = {
            option["value"]: option["available"] for option in initial["options"]
        }
        targets = [
            framework
            for framework in ("event_driven_multi_agent", "langgraph", "custom")
            if available[framework]
        ]
        try:
            for framework in targets:
                patch_status, updated = request_json(
                    "/api/admin/agent-runtime",
                    method="PATCH",
                    payload={"framework": framework},
                    headers=admin,
                )
                self.assertEqual(patch_status, 200, updated)
                self.assertEqual(updated["currentFramework"], framework)
                self.assertEqual(updated["activeFramework"], framework)

                agent_status_code, agent_status = request_json(
                    "/api/agent/status",
                    headers=admin,
                )
                self.assertEqual(agent_status_code, 200, agent_status)
                self.assertEqual(
                    agent_status["agentFramework"]["requested"],
                    framework,
                )
                self.assertEqual(
                    agent_status["agentFramework"]["active"],
                    framework,
                )
        finally:
            if available.get(original):
                request_json(
                    "/api/admin/agent-runtime",
                    method="PATCH",
                    payload={"framework": original},
                    headers=admin,
                )

    def test_student_is_forbidden_and_invalid_framework_is_rejected(self):
        student = basic_auth("stu0", "000000")
        admin = basic_auth("admin", "000000")

        get_status, _ = request_json("/api/admin/agent-runtime", headers=student)
        patch_status, _ = request_json(
            "/api/admin/agent-runtime",
            method="PATCH",
            payload={"framework": "custom"},
            headers=student,
        )
        invalid_status, _ = request_json(
            "/api/admin/agent-runtime",
            method="PATCH",
            payload={"framework": "unsupported"},
            headers=admin,
        )

        self.assertEqual(get_status, 403)
        self.assertEqual(patch_status, 403)
        self.assertEqual(invalid_status, 422)


if __name__ == "__main__":
    unittest.main()
