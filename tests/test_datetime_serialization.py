from datetime import UTC, datetime, timedelta, timezone
from unittest import TestCase

from fastapi.encoders import jsonable_encoder

from app.schemas.dtos import RiskCaseResponse


class DateTimeSerializationTest(TestCase):
    def test_risk_case_naive_database_timestamps_are_serialized_as_utc(self):
        response = RiskCaseResponse(
            id=31,
            reportId=35,
            riskLevel="MEDIUM",
            status="OPEN",
            owner="2017160177@qq.com",
            summary="询问原因",
            handoffSummary="",
            createdAt=datetime(2026, 7, 23, 8, 52, 18),
            updatedAt=datetime(2026, 7, 23, 8, 52, 18),
        )

        payload = jsonable_encoder(response)

        self.assertEqual(payload["createdAt"], "2026-07-23T08:52:18Z")
        self.assertEqual(payload["updatedAt"], "2026-07-23T08:52:18Z")

    def test_risk_case_aware_timestamps_are_normalized_to_utc(self):
        china_standard_time = timezone(timedelta(hours=8))
        response = RiskCaseResponse(
            id=31,
            reportId=35,
            riskLevel="MEDIUM",
            status="OPEN",
            owner="2017160177@qq.com",
            summary="询问原因",
            handoffSummary="",
            acknowledgedAt=datetime(2026, 7, 23, 16, 52, 18, tzinfo=china_standard_time),
            createdAt=datetime(2026, 7, 23, 8, 52, 18, tzinfo=UTC),
            updatedAt=datetime(2026, 7, 23, 16, 52, 18, tzinfo=china_standard_time),
        )

        payload = jsonable_encoder(response)

        self.assertEqual(payload["acknowledgedAt"], "2026-07-23T08:52:18Z")
        self.assertEqual(payload["createdAt"], "2026-07-23T08:52:18Z")
        self.assertEqual(payload["updatedAt"], "2026-07-23T08:52:18Z")
