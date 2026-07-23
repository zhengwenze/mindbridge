"""Docker/MySQL/Chroma integration tests for document management phase one."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
import unittest
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from tests.test_student_registration import basic_auth, request_json


BASE_URL = os.environ.get("MINDBRIDGE_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
ADMIN = basic_auth("admin", "000000")
STUDENT = basic_auth("stu0", "000000")


def request_multipart(
    path: str,
    *,
    filename: str,
    content: bytes,
    content_type: str = "text/plain",
    fields: dict[str, str | int] | None = None,
    headers: dict[str, str] | None = None,
) -> tuple[int, object]:
    boundary = f"mindbridge-{uuid.uuid4().hex}"
    body = bytearray()
    for name, value in (fields or {}).items():
        body.extend(f"--{boundary}\r\n".encode("ascii"))
        body.extend(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("ascii"))
        body.extend(str(value).encode("utf-8"))
        body.extend(b"\r\n")
    body.extend(f"--{boundary}\r\n".encode("ascii"))
    body.extend(
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode(
            "utf-8"
        )
    )
    body.extend(f"Content-Type: {content_type}\r\n\r\n".encode("ascii"))
    body.extend(content)
    body.extend(f"\r\n--{boundary}--\r\n".encode("ascii"))
    request = Request(
        f"{BASE_URL}{path}",
        data=bytes(body),
        method="POST",
        headers={
            "Accept": "application/json",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            **(headers or {}),
        },
    )
    try:
        with urlopen(request, timeout=120) as response:
            raw = response.read().decode("utf-8")
            return response.status, json.loads(raw) if raw else {}
    except HTTPError as exc:
        raw = exc.read().decode("utf-8")
        return exc.code, json.loads(raw) if raw else {}


class DocumentManagementDockerTests(unittest.TestCase):
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
        self.base_ids: list[int] = []

    def tearDown(self) -> None:
        for base_id in reversed(self.base_ids):
            try:
                request_json(f"/api/admin/knowledge-bases/{base_id}", "DELETE", headers=ADMIN)
            except Exception:
                pass

    def mysql(self, sql: str, *, scalar: bool = False) -> str:
        if shutil.which("docker"):
            command = ["docker", "compose", "exec", "-T", "mysql", "mysql", "-N", "-B"]
            command.extend(["-umindbridge", "-pmindbridge", "mindbridge", "-e", sql])
            result = subprocess.run(
                command,
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
            if scalar:
                value = result.scalar()
                return "" if value is None else str(value)
            return "\n".join("\t".join(str(value) for value in row) for row in result)

    def create_base(self) -> dict:
        name = f"文档管理集成测试-{uuid.uuid4().hex[:12]}"
        status, body = request_json(
            "/api/admin/knowledge-bases",
            "POST",
            {"name": name, "description": "document management integration"},
            ADMIN,
        )
        self.assertEqual(status, 201, body)
        self.base_ids.append(int(body["id"]))
        return body

    def upload(
        self,
        base_id: int,
        filename: str,
        content: str,
        *,
        chunk_size: int = 160,
        chunk_overlap: int = 20,
        relative_path: str | None = None,
        headers: dict[str, str] = ADMIN,
    ) -> tuple[int, object]:
        fields: dict[str, str | int] = {
            "chunk_size": chunk_size,
            "chunk_overlap": chunk_overlap,
            "splitter_type": "recursive_character",
        }
        if relative_path is not None:
            fields["relative_path"] = relative_path
        return request_multipart(
            f"/api/admin/knowledge-bases/{base_id}/documents",
            filename=filename,
            content=content.encode("utf-8"),
            content_type="text/markdown" if filename.endswith(".md") else "text/plain",
            fields=fields,
            headers=headers,
        )

    def chunk_ids(self, document_id: int) -> list[int]:
        output = self.mysql(
            "SELECT id FROM knowledge_chunks "
            f"WHERE document_id={int(document_id)} ORDER BY id"
        )
        return [int(value) for value in output.splitlines() if value.strip()]

    def document_json(self, document_id: int) -> dict:
        output = self.mysql(
            "SELECT JSON_OBJECT("
            "'id', id, 'chunkSize', chunk_size, 'chunkOverlap', chunk_overlap, "
            "'splitterType', splitter_type, 'parserName', parser_name, "
            "'parserVersion', parser_version, 'mimeType', mime_type, "
            "'contentHash', content_hash, 'revision', revision, "
            "'indexStatus', index_status, 'storagePath', storage_path, "
            "'parsedLength', CHAR_LENGTH(parsed_content), "
            "'indexedAt', DATE_FORMAT(indexed_at, '%Y-%m-%dT%H:%i:%s')) "
            f"FROM knowledge_documents WHERE id={int(document_id)}"
        )
        self.assertTrue(output, f"document {document_id} was not found")
        return json.loads(output)

    def chroma_ids(self, collection_name: str, chunk_ids: list[int]) -> set[str]:
        if not chunk_ids:
            return set()
        if shutil.which("docker"):
            script = (
                "import json,sys,chromadb; "
                "client=chromadb.PersistentClient(path='/app/data/chroma'); "
                "name=sys.argv[1]; ids=sys.argv[2:]; "
                "names={item.name for item in client.list_collections()}; "
                "print(json.dumps(client.get_collection(name).get(ids=ids).get('ids', []))) "
                "if name in names else print('[]')"
            )
            requested = [f"knowledge-chunk-{chunk_id}" for chunk_id in chunk_ids]
            result = subprocess.run(
                ["docker", "compose", "exec", "-T", "app", "python", "-c", script, collection_name, *requested],
                cwd=Path(__file__).resolve().parents[1],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            return set(json.loads(result.stdout.strip().splitlines()[-1]))

        import chromadb

        persist_dir = Path(__file__).resolve().parents[1] / "data" / "chroma"
        client = chromadb.PersistentClient(path=str(persist_dir))
        if collection_name not in {item.name for item in client.list_collections()}:
            return set()
        result = client.get_collection(collection_name).get(
            ids=[f"knowledge-chunk-{chunk_id}" for chunk_id in chunk_ids]
        )
        return set(result.get("ids") or [])

    @staticmethod
    def document_content(label: str, repetitions: int = 18) -> str:
        return (
            f"# {label}\n\n- 保留列表一\n- 保留列表二\n\n"
            + "这是用于知识库文档管理集成测试的中文段落。"
            "包含句号、问号？和感叹号！\n\n"
            * repetitions
        )

    def test_custom_upload_persists_parser_splitter_and_hash(self):
        base = self.create_base()
        content = self.document_content("自定义上传", repetitions=10)

        status, uploaded = self.upload(
            base["id"],
            "custom.md",
            content,
            chunk_size=180,
            chunk_overlap=30,
            relative_path="阶段一/custom.md",
        )

        self.assertEqual(status, 201, uploaded)
        self.assertEqual(uploaded["knowledgeBaseId"], base["id"])
        self.assertEqual(uploaded["relativePath"], "阶段一/custom.md")
        self.assertEqual(uploaded["parserName"], "markdown")
        self.assertEqual(uploaded["splitterType"], "recursive_character")
        self.assertEqual(uploaded["chunkSize"], 180)
        self.assertEqual(uploaded["chunkOverlap"], 30)
        self.assertEqual(uploaded["contentHash"], hashlib.sha256(content.strip().encode("utf-8")).hexdigest())
        self.assertEqual(uploaded["warnings"], [])
        self.assertGreater(uploaded["chunks"], 1)

        row = self.document_json(uploaded["id"])
        self.assertEqual(row["chunkSize"], 180)
        self.assertEqual(row["chunkOverlap"], 30)
        self.assertEqual(row["splitterType"], "recursive_character")
        self.assertEqual(row["parserName"], "markdown")
        self.assertEqual(row["mimeType"], "text/markdown")
        self.assertEqual(row["contentHash"], uploaded["contentHash"])
        self.assertEqual(row["revision"], 1)
        self.assertEqual(row["indexStatus"], "active")
        self.assertGreater(row["parsedLength"], 0)
        self.assertTrue(row["indexedAt"])
        self.assertTrue((Path(__file__).resolve().parents[1] / row["storagePath"]).is_file())

    def test_list_filters_paginates_and_sorts_without_chroma_lookup(self):
        base = self.create_base()
        documents: dict[str, dict] = {}
        for filename in ("charlie.md", "alpha.md", "bravo.md"):
            status, uploaded = self.upload(
                base["id"], filename, self.document_content(filename, repetitions=4)
            )
            self.assertEqual(status, 201, uploaded)
            documents[filename] = uploaded

        status, first_page = request_json(
            f"/api/admin/knowledge-bases/{base['id']}/documents?"
            + urlencode(
                {
                    "status": "active",
                    "created_from": "2020-01-01T00:00:00Z",
                    "created_to": "2035-01-01T00:00:00Z",
                    "page": 1,
                    "page_size": 2,
                    "sort_by": "file_name",
                    "sort_order": "asc",
                }
            ),
            headers=ADMIN,
        )
        self.assertEqual(status, 200, first_page)
        self.assertEqual(first_page["total"], 3)
        self.assertEqual(first_page["page"], 1)
        self.assertEqual(first_page["pageSize"], 2)
        self.assertEqual([item["fileName"] for item in first_page["items"]], ["alpha.md", "bravo.md"])
        self.assertTrue(all(item["chunkCount"] > 0 for item in first_page["items"]))

        status, second_page = request_json(
            f"/api/admin/knowledge-bases/{base['id']}/documents?"
            + urlencode(
                {
                    "page": 2,
                    "page_size": 2,
                    "sort_by": "file_name",
                    "sort_order": "asc",
                }
            ),
            headers=ADMIN,
        )
        self.assertEqual(status, 200, second_page)
        self.assertEqual([item["fileName"] for item in second_page["items"]], ["charlie.md"])

        status, filtered = request_json(
            f"/api/admin/knowledge-bases/{base['id']}/documents?"
            + urlencode({"name": "alpha", "status": "active"}),
            headers=ADMIN,
        )
        self.assertEqual(status, 200, filtered)
        self.assertEqual(filtered["total"], 1)
        self.assertEqual(filtered["items"][0]["id"], documents["alpha.md"]["id"])

    def test_split_preview_has_no_database_or_chroma_side_effects(self):
        base = self.create_base()
        status, uploaded = self.upload(
            base["id"], "preview.md", self.document_content("预览", repetitions=15), chunk_size=240
        )
        self.assertEqual(status, 201, uploaded)
        before_row = self.document_json(uploaded["id"])
        before_chunk_ids = self.chunk_ids(uploaded["id"])
        before_vector_ids = self.chroma_ids(base["collectionName"], before_chunk_ids)

        status, preview = request_json(
            f"/api/admin/knowledge-bases/{base['id']}/documents/{uploaded['id']}/split-preview",
            "POST",
            {"chunkSize": 100, "chunkOverlap": 10, "splitterType": "recursive_character"},
            ADMIN,
        )

        self.assertEqual(status, 200, preview)
        self.assertGreater(preview["totalChunks"], 1)
        self.assertEqual(preview["truncated"], preview["totalChunks"] > len(preview["items"]))
        self.assertTrue(all(item["index"] == index for index, item in enumerate(preview["items"])))
        self.assertTrue(all(item["charCount"] == len(item["content"]) for item in preview["items"]))
        self.assertTrue(all(item["charCount"] <= 100 for item in preview["items"]))

        self.assertEqual(self.document_json(uploaded["id"]), before_row)
        self.assertEqual(self.chunk_ids(uploaded["id"]), before_chunk_ids)
        self.assertEqual(self.chroma_ids(base["collectionName"], before_chunk_ids), before_vector_ids)

    def test_reindex_replaces_exact_old_vector_ids(self):
        base = self.create_base()
        status, uploaded = self.upload(
            base["id"], "reindex.md", self.document_content("重建", repetitions=20), chunk_size=360
        )
        self.assertEqual(status, 201, uploaded)
        old_ids = self.chunk_ids(uploaded["id"])
        self.assertEqual(
            self.chroma_ids(base["collectionName"], old_ids),
            {f"knowledge-chunk-{chunk_id}" for chunk_id in old_ids},
        )

        status, result = request_json(
            f"/api/admin/knowledge-bases/{base['id']}/documents/{uploaded['id']}/reindex",
            "POST",
            {"chunkSize": 100, "chunkOverlap": 10, "splitterType": "recursive_character"},
            ADMIN,
        )

        self.assertEqual(status, 200, result)
        self.assertEqual(result["revision"], 2)
        self.assertEqual(result["chunkSize"], 100)
        self.assertEqual(result["chunkOverlap"], 10)
        self.assertEqual(result["indexStatus"], "active")
        new_ids = self.chunk_ids(uploaded["id"])
        self.assertTrue(new_ids)
        self.assertTrue(set(old_ids).isdisjoint(new_ids))
        self.assertEqual(self.chroma_ids(base["collectionName"], old_ids), set())
        self.assertEqual(
            self.chroma_ids(base["collectionName"], new_ids),
            {f"knowledge-chunk-{chunk_id}" for chunk_id in new_ids},
        )
        row = self.document_json(uploaded["id"])
        self.assertEqual(row["revision"], 2)
        self.assertEqual(row["chunkSize"], 100)
        self.assertEqual(row["chunkOverlap"], 10)

    def test_reindex_failure_preserves_old_chunks_vectors_and_active_revision(self):
        base = self.create_base()
        status, uploaded = self.upload(
            base["id"], "reindex-failure.md", self.document_content("补偿", repetitions=12)
        )
        self.assertEqual(status, 201, uploaded)
        old_ids = self.chunk_ids(uploaded["id"])

        script = """
from app.core.config import get_settings
from app.core.database import SessionLocal
from app.models.entities import UserAccount
from app.services.document_management import KnowledgeDocumentService
from app.services.knowledge import KnowledgeDocumentProcessingError

db = SessionLocal()
try:
    actor = db.query(UserAccount).filter(UserAccount.username == 'admin').one()
    service = KnowledgeDocumentService(db, get_settings())
    original_upsert = service.index.upsert_rows
    failed = {'value': False}
    def fail_upsert(*args, **kwargs):
        if not failed['value']:
            failed['value'] = True
            raise RuntimeError('injected vector upsert failure')
        return original_upsert(*args, **kwargs)
    service.index.upsert_rows = fail_upsert
    try:
        service.reindex(
            int(__import__('sys').argv[1]),
            int(__import__('sys').argv[2]),
            chunk_size=100,
            chunk_overlap=10,
            splitter_type='recursive_character',
            actor=actor,
        )
    except KnowledgeDocumentProcessingError:
        pass
    else:
        raise AssertionError('injected reindex failure did not propagate')
finally:
    db.close()
"""
        command = (
            [
                "docker",
                "compose",
                "exec",
                "-T",
                "app",
                "python",
                "-c",
                script,
                str(base["id"]),
                str(uploaded["id"]),
            ]
            if shutil.which("docker")
            else [sys.executable, "-c", script, str(base["id"]), str(uploaded["id"])]
        )
        result = subprocess.run(
            command,
            cwd=Path(__file__).resolve().parents[1],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.chunk_ids(uploaded["id"]), old_ids)
        self.assertEqual(
            self.chroma_ids(base["collectionName"], old_ids),
            {f"knowledge-chunk-{chunk_id}" for chunk_id in old_ids},
        )
        row = self.document_json(uploaded["id"])
        self.assertEqual(row["indexStatus"], "active")
        self.assertEqual(row["revision"], 1)

    def test_single_delete_removes_database_vectors_and_file(self):
        base = self.create_base()
        status, uploaded = self.upload(
            base["id"], "single-delete.md", self.document_content("单删", repetitions=6)
        )
        self.assertEqual(status, 201, uploaded)
        chunk_ids = self.chunk_ids(uploaded["id"])
        stored_file = Path(__file__).resolve().parents[1] / self.document_json(uploaded["id"])["storagePath"]
        self.assertTrue(stored_file.is_file())

        status, deleted = request_json(
            f"/api/admin/knowledge-bases/{base['id']}/documents/{uploaded['id']}",
            "DELETE",
            headers=ADMIN,
        )

        self.assertEqual(status, 200, deleted)
        self.assertEqual(deleted["status"], "DELETED")
        self.assertEqual(
            self.mysql(
                f"SELECT COUNT(*) FROM knowledge_documents WHERE id={uploaded['id']}", scalar=True
            ),
            "0",
        )
        self.assertEqual(
            self.mysql(
                f"SELECT COUNT(*) FROM knowledge_chunks WHERE document_id={uploaded['id']}", scalar=True
            ),
            "0",
        )
        self.assertEqual(self.chroma_ids(base["collectionName"], chunk_ids), set())
        self.assertFalse(stored_file.exists())

    def test_batch_delete_is_all_success_and_removes_all_resources(self):
        base = self.create_base()
        uploaded_documents: list[dict] = []
        for filename in ("batch-one.md", "batch-two.md"):
            status, uploaded = self.upload(
                base["id"], filename, self.document_content(filename, repetitions=6)
            )
            self.assertEqual(status, 201, uploaded)
            uploaded_documents.append(uploaded)
        document_ids = [document["id"] for document in uploaded_documents]
        chunk_ids = [chunk_id for document_id in document_ids for chunk_id in self.chunk_ids(document_id)]
        stored_files = [
            Path(__file__).resolve().parents[1] / self.document_json(document_id)["storagePath"]
            for document_id in document_ids
        ]

        # Batch semantics are all-or-nothing: one missing ID must preserve the
        # valid document, its chunks, vectors, and file.
        status, rejected = request_json(
            f"/api/admin/knowledge-bases/{base['id']}/documents/batch-delete",
            "POST",
            {"documentIds": [document_ids[0], 999_999_999]},
            ADMIN,
        )
        self.assertEqual(status, 404, rejected)
        self.assertTrue(self.chunk_ids(document_ids[0]))
        self.assertEqual(
            self.chroma_ids(base["collectionName"], chunk_ids),
            {f"knowledge-chunk-{chunk_id}" for chunk_id in chunk_ids},
        )
        self.assertTrue(all(path.is_file() for path in stored_files))

        status, deleted = request_json(
            f"/api/admin/knowledge-bases/{base['id']}/documents/batch-delete",
            "POST",
            {"documentIds": document_ids},
            ADMIN,
        )

        self.assertEqual(status, 200, deleted)
        self.assertEqual(deleted["status"], "DELETED")
        self.assertEqual(deleted["deletedCount"], 2)
        ids_csv = ",".join(str(document_id) for document_id in document_ids)
        self.assertEqual(
            self.mysql(
                f"SELECT COUNT(*) FROM knowledge_documents WHERE id IN ({ids_csv})", scalar=True
            ),
            "0",
        )
        self.assertEqual(
            self.mysql(
                f"SELECT COUNT(*) FROM knowledge_chunks WHERE document_id IN ({ids_csv})", scalar=True
            ),
            "0",
        )
        self.assertEqual(self.chroma_ids(base["collectionName"], chunk_ids), set())
        self.assertTrue(all(not path.exists() for path in stored_files))

    def test_cross_knowledge_base_document_access_returns_404(self):
        owner = self.create_base()
        other = self.create_base()
        status, uploaded = self.upload(
            owner["id"], "scoped.md", self.document_content("隔离", repetitions=4)
        )
        self.assertEqual(status, 201, uploaded)
        split_payload = {
            "chunkSize": 100,
            "chunkOverlap": 10,
            "splitterType": "recursive_character",
        }

        requests = [
            (
                "POST",
                f"/api/admin/knowledge-bases/{other['id']}/documents/"
                f"{uploaded['id']}/split-preview",
                split_payload,
            ),
            (
                "POST",
                f"/api/admin/knowledge-bases/{other['id']}/documents/{uploaded['id']}/reindex",
                split_payload,
            ),
            ("DELETE", f"/api/admin/knowledge-bases/{other['id']}/documents/{uploaded['id']}", None),
            (
                "POST",
                f"/api/admin/knowledge-bases/{other['id']}/documents/batch-delete",
                {"documentIds": [uploaded["id"]]},
            ),
        ]
        for method, path, payload in requests:
            with self.subTest(method=method, path=path):
                status, body = request_json(path, method, payload, ADMIN)
                self.assertEqual(status, 404, body)

        status, listing = request_json(
            f"/api/admin/knowledge-bases/{other['id']}/documents", headers=ADMIN
        )
        self.assertEqual(status, 200, listing)
        self.assertEqual(listing["total"], 0)
        self.assertTrue(self.chunk_ids(uploaded["id"]))

    def test_students_cannot_access_document_management_endpoints(self):
        base = self.create_base()
        status, uploaded = self.upload(
            base["id"], "permissions.md", self.document_content("权限", repetitions=4)
        )
        self.assertEqual(status, 201, uploaded)
        payload = {"chunkSize": 100, "chunkOverlap": 10, "splitterType": "recursive_character"}
        requests = [
            ("GET", f"/api/admin/knowledge-bases/{base['id']}/documents", None),
            (
                "POST",
                f"/api/admin/knowledge-bases/{base['id']}/documents/"
                f"{uploaded['id']}/split-preview",
                payload,
            ),
            (
                "POST",
                f"/api/admin/knowledge-bases/{base['id']}/documents/{uploaded['id']}/reindex",
                payload,
            ),
            ("DELETE", f"/api/admin/knowledge-bases/{base['id']}/documents/{uploaded['id']}", None),
            (
                "POST",
                f"/api/admin/knowledge-bases/{base['id']}/documents/batch-delete",
                {"documentIds": [uploaded["id"]]},
            ),
        ]
        for method, path, request_payload in requests:
            with self.subTest(method=method, path=path):
                status, body = request_json(path, method, request_payload, STUDENT)
                self.assertEqual(status, 403, body)

        status, body = self.upload(
            base["id"], "student.md", self.document_content("学生", repetitions=2), headers=STUDENT
        )
        self.assertEqual(status, 403, body)

    def test_invalid_split_parameters_and_batch_payload_return_422(self):
        base = self.create_base()
        status, uploaded = self.upload(
            base["id"], "valid.md", self.document_content("参数", repetitions=4)
        )
        self.assertEqual(status, 201, uploaded)

        invalid_payloads = [
            {"chunkSize": 99, "chunkOverlap": 0, "splitterType": "recursive_character"},
            {"chunkSize": 100, "chunkOverlap": 100, "splitterType": "recursive_character"},
            {"chunkSize": 512, "chunkOverlap": 64, "splitterType": "token"},
            {
                "chunkSize": 512,
                "chunkOverlap": 64,
                "splitterType": "recursive_character",
                "unexpected": True,
            },
        ]
        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                status, body = request_json(
                    f"/api/admin/knowledge-bases/{base['id']}/documents/{uploaded['id']}/split-preview",
                    "POST",
                    payload,
                    ADMIN,
                )
                self.assertEqual(status, 422, body)

        status, body = self.upload(
            base["id"],
            "bad-overlap.md",
            self.document_content("非法", repetitions=2),
            chunk_size=100,
            chunk_overlap=100,
        )
        self.assertEqual(status, 422, body)

        status, body = request_json(
            f"/api/admin/knowledge-bases/{base['id']}/documents?sort_by=not_a_column",
            headers=ADMIN,
        )
        self.assertEqual(status, 422, body)

        status, body = request_json(
            f"/api/admin/knowledge-bases/{base['id']}/documents/batch-delete",
            "POST",
            {"documentIds": [uploaded["id"], uploaded["id"]]},
            ADMIN,
        )
        self.assertEqual(status, 422, body)
        self.assertTrue(self.chunk_ids(uploaded["id"]))


if __name__ == "__main__":
    unittest.main()
