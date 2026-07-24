"""Docker/MySQL integration coverage for admin overview and risk case filters."""

from __future__ import annotations

import os
import shutil
import subprocess
import time
import unittest
import uuid
from datetime import UTC, datetime, time as datetime_time, timedelta, timezone
from pathlib import Path
from urllib.error import URLError

from tests.test_student_registration import basic_auth, request_json


BASE_URL = os.environ.get("MINDBRIDGE_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
ADMIN = basic_auth("admin", "000000")
STUDENT = basic_auth("stu0", "000000")
CHINA_STANDARD_TIME = timezone(timedelta(hours=8))


class AdminOverviewAndCaseFilterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        deadline = time.time() + 90
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

    def setUp(self) -> None:
        self.marker = f"admin-filter-{uuid.uuid4().hex}"

    def tearDown(self) -> None:
        self.mysql(
            "DELETE FROM risk_cases "
            f"WHERE summary LIKE '{self.marker}%'"
        )
        self.mysql(
            "DELETE FROM psychological_reports "
            f"WHERE content = '{self.marker}'"
        )

    def mysql(self, sql: str) -> str:
        if shutil.which("docker"):
            result = subprocess.run(
                [
                    "docker",
                    "compose",
                    "exec",
                    "-T",
                    "mysql",
                    "mysql",
                    "-N",
                    "-B",
                    "-umindbridge",
                    "-pmindbridge",
                    "mindbridge",
                    "-e",
                    sql,
                ],
                cwd=Path(__file__).resolve().parents[1],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            return result.stdout.strip()

        from sqlalchemy import create_engine, text

        engine = create_engine(os.environ["DATABASE_URL"])
        with engine.begin() as connection:
            result = connection.execute(text(sql))
            if not result.returns_rows:
                return ""
            return "\n".join("\t".join(str(value) for value in row) for row in result)

    def test_overview_returns_full_aggregate_trend_and_distribution(self):
        status, overview = request_json("/api/admin/overview?days=30", headers=ADMIN)
        self.assertEqual(status, 200, overview)
        self.assertEqual(
            overview["summary"]["totalReports"],
            int(self.mysql("SELECT COUNT(*) FROM psychological_reports") or 0),
        )
        self.assertEqual(len(overview["dailyTrend"]), 30)
        self.assertEqual(
            overview["summary"]["periodReports"],
            sum(item["count"] for item in overview["riskDistribution"]),
        )
        self.assertEqual(
            {"HIGH", "MEDIUM", "LOW"},
            {item["riskLevel"] for item in overview["riskDistribution"]},
        )

        student_status, _ = request_json("/api/admin/overview", headers=STUDENT)
        invalid_status, _ = request_json("/api/admin/overview?days=3", headers=ADMIN)
        self.assertEqual(student_status, 403)
        self.assertEqual(invalid_status, 422)

    def test_case_filters_apply_before_server_pagination(self):
        report_base = 100_000_000 + uuid.uuid4().int % 800_000_000
        rows = [
            (report_base, "HIGH", "OPEN", "2099-01-04 00:00:00"),
            (report_base + 1, "HIGH", "ACKNOWLEDGED", "2099-01-03 00:00:00"),
            (report_base + 2, "MEDIUM", "OPEN", "2099-01-02 00:00:00"),
            (report_base + 3, "LOW", "ALERT_SENT", "2099-01-01 00:00:00"),
        ]
        values = ", ".join(
            "("
            f"{report_id}, '{risk_level}', '{status}', 'integration-test', "
            f"'{self.marker}-{report_id}', '', NOW(), '{updated_at}'"
            ")"
            for report_id, risk_level, status, updated_at in rows
        )
        self.mysql(
            "INSERT INTO risk_cases "
            "(report_id, risk_level, status, owner, summary, handoff_summary, created_at, updated_at) "
            f"VALUES {values}"
        )

        high_status, high = request_json(
            "/api/admin/cases?risk_level=HIGH&page=1&page_size=100",
            headers=ADMIN,
        )
        open_status, opened = request_json(
            "/api/admin/cases?status=OPEN&page=1&page_size=100",
            headers=ADMIN,
        )
        combined_status, combined = request_json(
            "/api/admin/cases?risk_level=HIGH&status=OPEN&page=1&page_size=1",
            headers=ADMIN,
        )

        self.assertEqual(high_status, 200, high)
        self.assertTrue(all(item["riskLevel"] == "HIGH" for item in high["items"]))
        self.assertTrue(all(item["status"] == "OPEN" for item in opened["items"]))
        self.assertEqual(open_status, 200, opened)
        self.assertEqual(combined_status, 200, combined)
        self.assertEqual(combined["items"][0]["summary"], f"{self.marker}-{report_base}")
        self.assertEqual(combined["pageSize"], 1)
        self.assertGreaterEqual(combined["total"], 1)

        invalid_level, _ = request_json("/api/admin/cases?risk_level=CRITICAL", headers=ADMIN)
        invalid_status, _ = request_json("/api/admin/cases?status=CLOSED", headers=ADMIN)
        self.assertEqual(invalid_level, 422)
        self.assertEqual(invalid_status, 422)

    def test_overview_groups_daily_trend_by_china_standard_time(self):
        before_status, before = request_json("/api/admin/overview?days=30", headers=ADMIN)
        self.assertEqual(before_status, 200, before)

        target_date = datetime.now(CHINA_STANDARD_TIME).date() - timedelta(days=2)
        utc_timestamp = (
            datetime.combine(target_date, datetime_time(hour=0, minute=30), tzinfo=CHINA_STANDARD_TIME)
            .astimezone(UTC)
            .replace(tzinfo=None)
        )
        session_row = self.mysql(
            "SELECT id, user_id FROM chat_sessions ORDER BY id LIMIT 1"
        ).split("\t")
        self.assertEqual(len(session_row), 2)
        session_id, user_id = (int(value) for value in session_row)
        self.mysql(
            "INSERT INTO psychological_reports "
            "(user_id, session_id, content, intent, emotion, emotion_score, risk_level, confidence, summary, created_at) "
            f"VALUES ({user_id}, {session_id}, '{self.marker}', 'CHAT', 'NORMAL', 0, 'LOW', 1, "
            f"'{self.marker}', '{utc_timestamp:%Y-%m-%d %H:%M:%S}')"
        )

        after_status, after = request_json("/api/admin/overview?days=30", headers=ADMIN)
        self.assertEqual(after_status, 200, after)
        before_points = {item["date"]: item for item in before["dailyTrend"]}
        after_points = {item["date"]: item for item in after["dailyTrend"]}
        self.assertEqual(
            after_points[target_date.isoformat()]["low"],
            before_points[target_date.isoformat()]["low"] + 1,
        )


if __name__ == "__main__":
    unittest.main()
