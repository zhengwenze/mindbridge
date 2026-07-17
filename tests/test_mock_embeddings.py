import unittest

from app.core.config import Settings
from app.services.vector_store import EmbeddingService


class MockEmbeddingTest(unittest.TestCase):
    def setUp(self):
        self.service = EmbeddingService(Settings(ai_provider="mock"))

    def test_mock_embeddings_are_deterministic_and_fixed_width(self):
        first = self.service.embed(["校园心理支持", "另一个文本"])
        second = self.service.embed(["校园心理支持"])

        self.assertEqual(first[0], second[0])
        self.assertEqual(32, len(first[0]))
        self.assertEqual(32, len(first[1]))
        self.assertNotEqual(first[0], first[1])

    def test_mock_embeddings_handle_blank_text(self):
        self.assertEqual(self.service.embed([" "]), self.service.embed([""]))


if __name__ == "__main__":
    unittest.main()
