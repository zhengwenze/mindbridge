from __future__ import annotations

import re
from datetime import UTC, datetime, time, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.entities import AlertRecord, AgentRunTrace, CaseNote, ChatMessage, ChatSession, DeadLetterRecord, ExcelRecord, KnowledgeDocument, PsychologicalReport, RiskCase, ToolAuditRecord, ToolJob, UserAccount
from app.schemas.dtos import AdminOverviewProcessingResponse, AdminOverviewResponse, AdminOverviewRiskDistributionItem, AdminOverviewSummaryResponse, AdminOverviewTrendPoint, AgentRunTraceResponse, CaseNoteResponse, ConversationMessageResponse, ConversationResponse, DeadLetterResponse, ReportResponse, RiskCaseListResponse, RiskCaseResponse, StudentConversationMessageResponse, StudentConversationResponse, StudentSessionSummaryResponse, ToolAuditResponse, ToolJobResponse, ToolRecordResponse


CHINA_STANDARD_TIME = timezone(timedelta(hours=8))


class ReportService:
    def __init__(self, db: Session):
        self.db = db

    def latest_reports(self, user_id: int | None = None) -> list[ReportResponse]:
        query = self.db.query(PsychologicalReport).order_by(PsychologicalReport.created_at.desc())
        if user_id is not None:
            query = query.filter(PsychologicalReport.user_id == user_id)
        return [self._report_response(item) for item in query.limit(100).all()]

    def excel_records(self) -> list[ToolRecordResponse]:
        rows = self.db.query(ExcelRecord).order_by(ExcelRecord.created_at.desc()).limit(100).all()
        return [
            ToolRecordResponse(id=row.id, reportId=row.report_id, status=row.status, message=row.message, createdAt=row.created_at, filePath=row.file_path)
            for row in rows
        ]

    def alert_records(self) -> list[ToolRecordResponse]:
        rows = self.db.query(AlertRecord).order_by(AlertRecord.created_at.desc()).limit(100).all()
        return [
            ToolRecordResponse(
                id=row.id,
                reportId=row.report_id,
                status=row.status,
                message=row.message,
                createdAt=row.created_at,
                channel=row.channel,
                recipient=row.recipient,
            )
            for row in rows
        ]

    def admin_overview(self, days: int) -> AdminOverviewResponse:
        generated_at = datetime.utcnow()
        generated_at_utc = generated_at.replace(tzinfo=UTC)
        today = generated_at_utc.astimezone(CHINA_STANDARD_TIME).date()
        start_date = today - timedelta(days=days - 1)
        start_at = (
            datetime.combine(start_date, time.min, tzinfo=CHINA_STANDARD_TIME)
            .astimezone(UTC)
            .replace(tzinfo=None)
        )
        end_at = (
            datetime.combine(today + timedelta(days=1), time.min, tzinfo=CHINA_STANDARD_TIME)
            .astimezone(UTC)
            .replace(tzinfo=None)
        )

        total_reports = self.db.query(func.count(PsychologicalReport.id)).scalar() or 0
        report_rows = (
            self.db.query(PsychologicalReport.created_at, PsychologicalReport.risk_level)
            .filter(PsychologicalReport.created_at >= start_at, PsychologicalReport.created_at < end_at)
            .all()
        )
        risk_counts = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
        trend_counts: dict[str, dict[str, int]] = {}
        for created_at, risk_level in report_rows:
            normalized = str(risk_level or "").upper()
            if normalized in risk_counts:
                risk_counts[normalized] += 1
                created_at_utc = created_at.replace(tzinfo=UTC)
                day_key = created_at_utc.astimezone(CHINA_STANDARD_TIME).date().isoformat()
                values = trend_counts.setdefault(day_key, {"HIGH": 0, "MEDIUM": 0, "LOW": 0})
                values[normalized] += 1

        daily_trend: list[AdminOverviewTrendPoint] = []
        for offset in range(days):
            day = start_date + timedelta(days=offset)
            values = trend_counts.get(day.isoformat(), {"HIGH": 0, "MEDIUM": 0, "LOW": 0})
            daily_trend.append(
                AdminOverviewTrendPoint(
                    date=day.isoformat(),
                    total=sum(values.values()),
                    high=values["HIGH"],
                    medium=values["MEDIUM"],
                    low=values["LOW"],
                )
            )

        period_reports = sum(risk_counts.values())
        high_risk_reports = risk_counts["HIGH"]
        high_risk_rate = round(high_risk_reports * 100 / period_reports, 1) if period_reports else 0.0
        risk_distribution = [
            AdminOverviewRiskDistributionItem(
                riskLevel=risk_level,
                count=risk_counts[risk_level],
                percentage=round(risk_counts[risk_level] * 100 / period_reports, 1) if period_reports else 0.0,
            )
            for risk_level in ("HIGH", "MEDIUM", "LOW")
        ]

        excel_counts = self._period_status_counts(ExcelRecord, start_at, end_at)
        alert_counts = self._period_status_counts(AlertRecord, start_at, end_at)
        excel_total = sum(excel_counts.values())
        alert_total = sum(alert_counts.values())
        alert_success = alert_counts.get("SUCCESS", 0)

        return AdminOverviewResponse(
            periodDays=days,
            generatedAt=generated_at,
            summary=AdminOverviewSummaryResponse(
                totalReports=int(total_reports),
                periodReports=period_reports,
                todayReports=daily_trend[-1].total,
                periodHighRiskReports=high_risk_reports,
                periodHighRiskRate=high_risk_rate,
            ),
            riskDistribution=risk_distribution,
            dailyTrend=daily_trend,
            processing=AdminOverviewProcessingResponse(
                excelTotal=excel_total,
                excelSuccess=excel_counts.get("SUCCESS", 0),
                excelFailed=excel_counts.get("FAILED", 0),
                alertTotal=alert_total,
                alertSuccess=alert_success,
                alertFailed=alert_counts.get("FAILED", 0),
                alertSuccessRate=round(alert_success * 100 / alert_total, 1) if alert_total else 0.0,
            ),
        )

    def risk_cases(
        self,
        *,
        risk_level: str | None = None,
        status: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> RiskCaseListResponse:
        query = self.db.query(RiskCase)
        if risk_level is not None:
            query = query.filter(RiskCase.risk_level == risk_level)
        if status is not None:
            query = query.filter(RiskCase.status == status)
        total = query.count()
        rows = (
            query.order_by(RiskCase.updated_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        items = [
            RiskCaseResponse(
                id=row.id,
                reportId=row.report_id,
                riskLevel=row.risk_level,
                status=row.status,
                owner=row.owner,
                summary=row.summary,
                handoffSummary=row.handoff_summary,
                acknowledgedBy=row.acknowledged_by,
                acknowledgedAt=row.acknowledged_at,
                createdAt=row.created_at,
                updatedAt=row.updated_at,
            )
            for row in rows
        ]
        return RiskCaseListResponse(items=items, total=total, page=page, pageSize=page_size)

    def _period_status_counts(self, model, start_at: datetime, end_at: datetime) -> dict[str, int]:
        rows = (
            self.db.query(model.status, func.count(model.id))
            .filter(model.created_at >= start_at, model.created_at < end_at)
            .group_by(model.status)
            .all()
        )
        return {str(status or "").upper(): int(count) for status, count in rows}

    def case_notes(self, case_id: int) -> list[CaseNoteResponse]:
        rows = self.db.query(CaseNote).filter(CaseNote.case_id == case_id).order_by(CaseNote.created_at.asc()).all()
        return [
            CaseNoteResponse(id=row.id, caseId=row.case_id, actor=row.actor, note=row.note, createdAt=row.created_at)
            for row in rows
        ]

    def tool_jobs(self) -> list[ToolJobResponse]:
        rows = self.db.query(ToolJob).order_by(ToolJob.created_at.desc()).limit(100).all()
        return [
            ToolJobResponse(
                id=row.id,
                reportId=row.report_id,
                kind=row.kind,
                status=row.status,
                attempts=row.attempts,
                maxAttempts=row.max_attempts,
                dependsOnJobId=row.depends_on_job_id,
                runAfter=row.run_after,
                lastError=row.last_error,
                createdAt=row.created_at,
                updatedAt=row.updated_at,
            )
            for row in rows
        ]

    def dead_letters(self) -> list[DeadLetterResponse]:
        rows = self.db.query(DeadLetterRecord).order_by(DeadLetterRecord.created_at.desc()).limit(100).all()
        return [
            DeadLetterResponse(
                id=row.id,
                jobId=row.job_id,
                reportId=row.report_id,
                kind=row.kind,
                reason=row.reason,
                payload=row.payload,
                createdAt=row.created_at,
            )
            for row in rows
        ]

    def agent_run_traces(self) -> list[AgentRunTraceResponse]:
        rows = self.db.query(AgentRunTrace).order_by(AgentRunTrace.created_at.desc()).limit(100).all()
        responses = []
        for row in rows:
            user = self.db.get(UserAccount, row.user_id)
            session = self.db.get(ChatSession, row.session_id)
            responses.append(
                AgentRunTraceResponse(
                    id=row.id,
                    sessionId=session.public_id if session else "",
                    reportId=row.report_id,
                    username=user.username if user else "",
                    intent=row.intent,
                    riskLevel=row.risk_level,
                    originalInput=row.original_input,
                    sanitizedInput=row.sanitized_input,
                    memoryBrief=row.memory_brief,
                    agentSteps=_loads(row.agent_steps_json, []),
                    retrievedKnowledge=_loads(row.retrieved_knowledge_json, []),
                    responseMessages=_loads(row.response_messages_json, []),
                    assessment=_loads(row.assessment_json, {}),
                    createdAt=row.created_at,
                )
            )
        return responses

    def tool_audits(self) -> list[ToolAuditResponse]:
        rows = self.db.query(ToolAuditRecord).order_by(ToolAuditRecord.created_at.desc()).limit(100).all()
        return [
            ToolAuditResponse(
                id=row.id,
                jobId=row.job_id,
                reportId=row.report_id,
                toolName=row.tool_name,
                policy=row.policy,
                allowed=row.allowed,
                status=row.status,
                reason=row.reason,
                payload=_loads(row.payload, {}),
                createdAt=row.created_at,
                updatedAt=row.updated_at,
            )
            for row in rows
        ]

    def conversation(self, public_id: str) -> ConversationResponse:
        session = self.db.query(ChatSession).filter(ChatSession.public_id == public_id).first()
        if session is None:
            raise ValueError("Session not found")
        rows = self.db.query(ChatMessage).filter(ChatMessage.session_id == session.id).order_by(ChatMessage.created_at.asc()).all()
        return ConversationResponse(
            sessionId=session.public_id,
            title=session.title,
            messages=[ConversationMessageResponse(role=row.role, content=row.content, createdAt=row.created_at) for row in rows],
        )

    def student_sessions(self, user_id: int) -> list[StudentSessionSummaryResponse]:
        sessions = (
            self.db.query(ChatSession)
            .filter(ChatSession.user_id == user_id)
            .order_by(ChatSession.updated_at.desc())
            .all()
        )
        summaries = []
        for session in sessions:
            last_message = (
                self.db.query(ChatMessage)
                .filter(ChatMessage.session_id == session.id)
                .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
                .first()
            )
            message_count = self.db.query(ChatMessage).filter(ChatMessage.session_id == session.id).count()
            summaries.append(
                StudentSessionSummaryResponse(
                    sessionId=session.public_id,
                    title=session.title,
                    lastMessage=last_message.content if last_message else "",
                    messageCount=message_count,
                    createdAt=session.created_at,
                    updatedAt=session.updated_at,
                )
            )
        return summaries

    def student_conversation(self, user_id: int, public_id: str) -> StudentConversationResponse:
        session = (
            self.db.query(ChatSession)
            .filter(ChatSession.public_id == public_id, ChatSession.user_id == user_id)
            .first()
        )
        if session is None:
            raise ValueError("Session not found")
        rows = (
            self.db.query(ChatMessage)
            .filter(ChatMessage.session_id == session.id)
            .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
            .all()
        )
        return StudentConversationResponse(
            sessionId=session.public_id,
            title=session.title,
            messages=[
                StudentConversationMessageResponse(
                    id=row.id,
                    role=row.role,
                    content=row.content,
                    createdAt=row.created_at,
                    sources=self._message_sources(row.content),
                )
                for row in rows
            ],
        )

    def _message_sources(self, content: str) -> list[dict]:
        names = list(dict.fromkeys(re.findall(r"【来源：\s*([^】|]+?)\s*】", content or "")))
        if not names:
            return []
        rows = self.db.query(KnowledgeDocument).filter(
            KnowledgeDocument.file_name.in_(names),
            KnowledgeDocument.deleted_at.is_(None),
            KnowledgeDocument.index_status == "active",
        ).all()
        by_name = {row.file_name: row for row in rows}
        return [
            {
                "sourceId": f"history-source-{index}",
                "documentId": by_name[name].id,
                "knowledgeBaseId": by_name[name].knowledge_base_id,
                "fileName": name,
            }
            for index, name in enumerate(names, start=1)
            if name in by_name
        ]

    def _report_response(self, report: PsychologicalReport) -> ReportResponse:
        user = self.db.get(UserAccount, report.user_id)
        session = self.db.get(ChatSession, report.session_id)
        return ReportResponse(
            id=report.id,
            sessionId=session.public_id if session else "",
            username=user.username if user else "",
            displayName=user.display_name if user else "",
            content=report.content,
            intent=report.intent,
            emotion=report.emotion,
            emotionScore=report.emotion_score,
            riskLevel=report.risk_level,
            confidence=report.confidence,
            summary=report.summary,
            createdAt=report.created_at,
        )


def _loads(raw: str, default):
    import json

    try:
        return json.loads(raw or "")
    except Exception:
        return default
