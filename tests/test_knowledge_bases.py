"""Docker/MySQL integration checks for isolated knowledge-base management."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import uuid
import unittest
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

from tests.test_student_registration import basic_auth, request_json


ADMIN = basic_auth("admin", "admin123")


class KnowledgeBaseDockerTests(unittest.TestCase):
    def mysql(self, sql: str, *, scalar: bool = False) -> str:
        if shutil.which("docker"):
            command = ["docker", "compose", "exec", "-T", "mysql", "mysql"]
            if scalar:
                command.append("-N")
            command.extend(["-umindbridge", "-pmindbridge", "mindbridge", "-e", sql])
            result = subprocess.run(command, cwd=".", capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 0, result.stderr)
            return result.stdout.strip()
        from sqlalchemy import create_engine, text
        engine = create_engine(os.environ["DATABASE_URL"])
        with engine.begin() as connection:
            result = connection.execute(text(sql))
            return str(result.scalar() if scalar else "")

    def create_base(self, name: str | None = None) -> dict:
        name = name or f"集成测试知识库-{uuid.uuid4().hex[:10]}"
        status, body = request_json("/api/admin/knowledge-bases", "POST", {"name": name, "description": "Docker MySQL integration test"}, ADMIN)
        self.assertEqual(status, 201, body)
        self.assertEqual(body["name"], name)
        self.assertEqual(body["collectionName"], f"mindbridge_kb_{body['id']}")
        return body

    def test_create_duplicate_filter_edit_blocked_delete_and_idempotent_retry(self):
        base = self.create_base()
        duplicate_status, duplicate = request_json("/api/admin/knowledge-bases", "POST", {"name": base["name"]}, ADMIN)
        self.assertEqual(duplicate_status, 409, duplicate)

        list_status, listing = request_json(f"/api/admin/knowledge-bases?{urlencode({'name': base['name'], 'status': 'active', 'page': 1, 'page_size': 10})}", headers=ADMIN)
        self.assertEqual(list_status, 200, listing)
        self.assertTrue(any(item["id"] == base["id"] for item in listing["items"]))
        self.assertEqual(next(item for item in listing["items"] if item["id"] == base["id"])["documentCount"], 0)

        update_status, updated = request_json(f"/api/admin/knowledge-bases/{base['id']}", "PATCH", {"name": f"{base['name']}-已编辑", "description": "updated", "status": "disabled"}, ADMIN)
        self.assertEqual(update_status, 200, updated)
        self.assertEqual(updated["collectionName"], base["collectionName"])
        self.assertEqual(updated["status"], "disabled")

        self.mysql(
            "INSERT INTO knowledge_base_references "
            "(knowledge_base_id, reference_type, reference_id, reference_name, status, blocking, created_at, updated_at) "
            f"VALUES ({base['id']}, 'agent', 'agent-test', '测试 Agent', 'active', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())"
        )
        delete_status, blocked = request_json(f"/api/admin/knowledge-bases/{base['id']}", "DELETE", headers=ADMIN)
        self.assertEqual(delete_status, 409, blocked)
        self.assertEqual(blocked["detail"]["code"], "KNOWLEDGE_BASE_IN_USE")
        self.assertEqual(blocked["detail"]["references"][0]["type"], "agent")

        self.mysql(f"DELETE FROM knowledge_base_references WHERE knowledge_base_id={base['id']}")
        delete_status, deleted = request_json(f"/api/admin/knowledge-bases/{base['id']}", "DELETE", headers=ADMIN)
        self.assertEqual(delete_status, 200, deleted)
        self.assertEqual(deleted["status"], "DELETED")
        normal_status, normal_list = request_json(f"/api/admin/knowledge-bases?{urlencode({'name': updated['name']})}", headers=ADMIN)
        self.assertEqual(normal_status, 200, normal_list)
        self.assertFalse(any(item["id"] == base["id"] for item in normal_list["items"]))

        retry_status, retry = request_json(f"/api/admin/knowledge-bases/{base['id']}", "DELETE", headers=ADMIN)
        self.assertEqual(retry_status, 200, retry)
        self.assertTrue(retry["idempotent"])

        audit_count = self.mysql(
            f"SELECT COUNT(*) FROM knowledge_base_operation_logs WHERE knowledge_base_id={base['id']} AND action='delete' AND status='success'",
            scalar=True,
        )
        self.assertGreaterEqual(int(audit_count), 1)

    def test_list_time_filters_accept_iso_dates(self):
        base = self.create_base()
        before = (datetime.now(UTC) - timedelta(minutes=1)).isoformat()
        after = (datetime.now(UTC) + timedelta(minutes=1)).isoformat()
        status, body = request_json(f"/api/admin/knowledge-bases?{urlencode({'created_from': before, 'created_to': after})}", headers=ADMIN)
        self.assertEqual(status, 200, body)
        self.assertTrue(any(item["id"] == base["id"] for item in body["items"]))


if __name__ == "__main__":
    unittest.main()
