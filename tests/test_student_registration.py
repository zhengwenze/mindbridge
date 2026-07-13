import base64
import json
import os
import time
import unittest
from datetime import UTC, datetime
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


BASE_URL = os.environ.get("MINDBRIDGE_BASE_URL", "http://127.0.0.1:8000").rstrip("/")


def request_json(path: str, method: str = "GET", payload: dict | None = None, headers: dict | None = None) -> tuple[int, dict]:
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
        data = exc.read().decode("utf-8")
        return exc.code, json.loads(data) if data else {}


def basic_auth(username: str, password: str) -> dict[str, str]:
    token = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("utf-8")
    return {"Authorization": f"Basic {token}"}


class StudentRegistrationDockerTests(unittest.TestCase):
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

    def test_student_registration_creates_login_enabled_user(self):
        username = f"reg_student_{datetime.now(UTC).strftime('%Y%m%d%H%M%S%f')}"
        password = "student123"

        status, body = request_json(
            "/api/register/student",
            method="POST",
            payload={"username": username, "password": password, "displayName": "Registered Student"},
        )

        self.assertEqual(status, 201, body)
        self.assertEqual(body["username"], username)
        self.assertEqual(body["displayName"], "Registered Student")
        self.assertEqual(body["roles"], [{"authority": "ROLE_USER"}])

        profile_status, profile = request_json("/api/profile", headers=basic_auth(username, password))
        self.assertEqual(profile_status, 200, profile)
        self.assertEqual(profile["username"], username)

        duplicate_status, duplicate = request_json(
            "/api/register/student",
            method="POST",
            payload={"username": username, "password": "student456"},
        )
        self.assertEqual(duplicate_status, 409, duplicate)
        self.assertEqual(duplicate["detail"], "用户名已被注册")


if __name__ == "__main__":
    unittest.main()
