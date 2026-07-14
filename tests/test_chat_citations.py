from types import SimpleNamespace

from app.services.chat import normalize_citations, source_metadata


def result(**overrides):
    values = {
        "chunk_id": 7,
        "source": "葡萄品种手册.txt",
        "content": "赤霞珠适合温暖地区。",
        "score": 0.9,
        "knowledge_base_id": 3,
        "document_id": 12,
        "document_name": "葡萄品种手册.txt",
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_source_metadata_contains_document_identity_and_snippet():
    sources = source_metadata([result()])
    assert sources == [{
        "sourceId": "source-1",
        "documentId": 12,
        "knowledgeBaseId": 3,
        "fileName": "葡萄品种手册.txt",
        "chunkId": 7,
        "snippet": "赤霞珠适合温暖地区。",
    }]


def test_normalize_citations_only_rewrites_known_sources():
    sources = source_metadata([result()])
    content, cited = normalize_citations(
        "答案【来源：source-1】；错误引用【来源：source-99】。", sources
    )
    assert "【来源：葡萄品种手册.txt】" in content
    assert "【来源：source-99】" in content
    assert cited == sources
