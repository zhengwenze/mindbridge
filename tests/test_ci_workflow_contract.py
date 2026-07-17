from pathlib import Path
import unittest


WORKFLOW = Path(__file__).resolve().parents[1] / ".github" / "workflows" / "test.yml"
ENTRYPOINT = Path(__file__).resolve().parents[1] / "scripts" / "entrypoint.sh"


class CiWorkflowContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.workflow = WORKFLOW.read_text(encoding="utf-8")

    def test_ci_uses_the_project_docker_stack_instead_of_sqlite(self):
        self.assertIn("docker compose up -d --build", self.workflow)
        self.assertIn("docker compose exec -T app", self.workflow)
        self.assertNotIn("DATABASE_URL: sqlite", self.workflow)

    def test_ci_actions_use_node_24_compatible_versions(self):
        self.assertIn("actions/checkout@v5", self.workflow)

    def test_ci_starts_and_health_checks_the_application_before_tests(self):
        application = self.workflow.index("docker compose up -d --build")
        health_check = self.workflow.index("/actuator/health")
        tests = self.workflow.index("python -m unittest discover -s tests")

        self.assertLess(application, health_check)
        self.assertLess(health_check, tests)

    def test_ci_prints_application_log_when_a_step_fails(self):
        self.assertIn("if: failure()", self.workflow)
        self.assertIn("docker compose logs --no-color", self.workflow)

    def test_ci_uses_mock_ai_with_vectors_and_without_ollama(self):
        self.assertIn("AI_PROVIDER: mock", self.workflow)
        self.assertIn('KNOWLEDGE_VECTOR_ENABLED: "true"', self.workflow)
        entrypoint = ENTRYPOINT.read_text(encoding="utf-8")
        self.assertIn('if [ "${AI_PROVIDER,,}" != "mock" ]', entrypoint)
        self.assertIn("AI_PROVIDER=mock, skipping Ollama readiness checks.", entrypoint)


if __name__ == "__main__":
    unittest.main()
