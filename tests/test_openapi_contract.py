import unittest

from app.main import app


class OpenApiContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schema = app.openapi()

    def test_documentation_metadata_and_business_tags_are_exposed(self):
        self.assertEqual("MindBridge API", self.schema["info"]["title"])
        tag_names = {tag["name"] for tag in self.schema["tags"]}
        self.assertTrue(
            {"System", "Authentication", "Student", "Chat", "Administration", "Knowledge Bases"}
            <= tag_names
        )

    def test_basic_auth_is_declared_for_protected_operations(self):
        schemes = self.schema["components"]["securitySchemes"]
        self.assertTrue(any(scheme.get("scheme") == "basic" for scheme in schemes.values()))
        operation = self.schema["paths"]["/api/profile"]["get"]
        self.assertTrue(operation["security"])

    def test_public_health_check_does_not_require_authentication(self):
        operation = self.schema["paths"]["/actuator/health"]["get"]
        self.assertFalse(operation.get("security"))

    def test_admin_overview_and_case_filter_contracts_are_exposed(self):
        overview = self.schema["paths"]["/api/admin/overview"]["get"]
        self.assertTrue(overview["security"])
        self.assertEqual(
            {"days"},
            {parameter["name"] for parameter in overview["parameters"]},
        )

        cases = self.schema["paths"]["/api/admin/cases"]["get"]
        parameters = {parameter["name"]: parameter for parameter in cases["parameters"]}
        self.assertEqual(
            {"risk_level", "status", "page", "page_size"},
            set(parameters),
        )
        self.assertTrue(cases["security"])


if __name__ == "__main__":
    unittest.main()
