
-- MindBridge MySQL 8.0 schema
-- Generated from Alembic revision 20260713_0005.
-- Contains table definitions only; no application or migration-version data.

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
DROP TABLE IF EXISTS `agent_run_traces`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `agent_run_traces` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `session_id` int NOT NULL,
  `report_id` int DEFAULT NULL,
  `intent` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `risk_level` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `original_input` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `sanitized_input` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `memory_brief` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `agent_steps_json` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `retrieved_knowledge_json` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `response_messages_json` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `assessment_json` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_agent_run_traces_user_id` (`user_id`),
  KEY `ix_agent_run_traces_risk_level` (`risk_level`),
  KEY `ix_agent_run_traces_report_id` (`report_id`),
  KEY `ix_agent_run_traces_session_id` (`session_id`),
  KEY `ix_agent_run_traces_intent` (`intent`),
  CONSTRAINT `agent_run_traces_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`),
  CONSTRAINT `agent_run_traces_ibfk_2` FOREIGN KEY (`session_id`) REFERENCES `chat_sessions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `alembic_version`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `alembic_version` (
  `version_num` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`version_num`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `alert_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `alert_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `report_id` int NOT NULL,
  `channel` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipient` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_alert_records_report_id` (`report_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `case_notes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `case_notes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `case_id` int NOT NULL,
  `actor` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_case_notes_case_id` (`case_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `chat_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chat_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `session_id` int NOT NULL,
  `role` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `session_id` (`session_id`),
  CONSTRAINT `chat_messages_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`),
  CONSTRAINT `chat_messages_ibfk_2` FOREIGN KEY (`session_id`) REFERENCES `chat_sessions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `chat_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chat_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `public_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_chat_sessions_public_id` (`public_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `chat_sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `dead_letter_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dead_letter_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `job_id` int DEFAULT NULL,
  `report_id` int NOT NULL,
  `kind` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_dead_letter_records_report_id` (`report_id`),
  KEY `ix_dead_letter_records_kind` (`kind`),
  KEY `ix_dead_letter_records_job_id` (`job_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `excel_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `excel_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `report_id` int NOT NULL,
  `file_path` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_excel_records_report_id` (`report_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `knowledge_base_operation_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `knowledge_base_operation_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `knowledge_base_id` int DEFAULT NULL,
  `actor_id` int DEFAULT NULL,
  `action` varchar(48) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `detail_json` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_knowledge_base_operation_logs_knowledge_base_id` (`knowledge_base_id`),
  KEY `ix_knowledge_base_operation_logs_actor_id` (`actor_id`),
  KEY `ix_knowledge_base_operation_logs_action` (`action`),
  KEY `ix_knowledge_base_operation_logs_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `knowledge_base_references`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `knowledge_base_references` (
  `id` int NOT NULL AUTO_INCREMENT,
  `knowledge_base_id` int NOT NULL,
  `reference_type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reference_id` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reference_name` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `blocking` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_knowledge_base_reference` (`knowledge_base_id`,`reference_type`,`reference_id`),
  KEY `ix_knowledge_base_references_knowledge_base_id` (`knowledge_base_id`),
  KEY `ix_knowledge_base_references_reference_type` (`reference_type`),
  KEY `ix_knowledge_base_references_status` (`status`),
  KEY `ix_knowledge_base_references_blocking` (`blocking`),
  CONSTRAINT `knowledge_base_references_ibfk_1` FOREIGN KEY (`knowledge_base_id`) REFERENCES `knowledge_bases` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `knowledge_bases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `knowledge_bases` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `collection_name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_by` int DEFAULT NULL,
  `active_name` varchar(128) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS (if((`deleted_at` is null),`name`,NULL)) VIRTUAL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_knowledge_bases_collection_name` (`collection_name`),
  UNIQUE KEY `collection_name` (`collection_name`),
  UNIQUE KEY `uq_knowledge_bases_active_name` (`active_name`),
  KEY `ix_knowledge_bases_status` (`status`),
  KEY `ix_knowledge_bases_created_by` (`created_by`),
  KEY `ix_knowledge_bases_deleted_at` (`deleted_at`),
  CONSTRAINT `knowledge_bases_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `user_accounts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `knowledge_chunks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `knowledge_chunks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `source` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_index` int NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `embedding_json` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL,
  `knowledge_base_id` int NOT NULL,
  `document_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_knowledge_chunks_source` (`source`),
  KEY `ix_knowledge_chunks_knowledge_base_id` (`knowledge_base_id`),
  KEY `ix_knowledge_chunks_document_id` (`document_id`),
  KEY `ix_knowledge_chunks_kb_document` (`knowledge_base_id`,`document_id`),
  CONSTRAINT `fk_chunks_document` FOREIGN KEY (`document_id`) REFERENCES `knowledge_documents` (`id`),
  CONSTRAINT `fk_chunks_kb` FOREIGN KEY (`knowledge_base_id`) REFERENCES `knowledge_bases` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `knowledge_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `knowledge_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `knowledge_base_id` int NOT NULL,
  `file_name` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'text',
  `file_size` int NOT NULL DEFAULT '0',
  `storage_path` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `index_status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'indexing',
  `error_message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `relative_path` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
  `parsed_content` longtext COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (_utf8mb4''),
  `content_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  `parser_name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'legacy_chunks',
  `parser_version` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '1',
  `splitter_type` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'recursive_character',
  `chunk_size` int NOT NULL DEFAULT '512',
  `chunk_overlap` int NOT NULL DEFAULT '64',
  `revision` int NOT NULL DEFAULT '1',
  `indexed_at` datetime DEFAULT NULL,
  `mime_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_knowledge_document_path` (`knowledge_base_id`,`relative_path`),
  KEY `ix_knowledge_documents_knowledge_base_id` (`knowledge_base_id`),
  KEY `ix_knowledge_documents_index_status` (`index_status`),
  KEY `ix_knowledge_documents_deleted_at` (`deleted_at`),
  CONSTRAINT `knowledge_documents_ibfk_1` FOREIGN KEY (`knowledge_base_id`) REFERENCES `knowledge_bases` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `psychological_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `psychological_reports` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `session_id` int NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `intent` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `emotion` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `emotion_score` float NOT NULL,
  `risk_level` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `confidence` float NOT NULL,
  `summary` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `session_id` (`session_id`),
  CONSTRAINT `psychological_reports_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_accounts` (`id`),
  CONSTRAINT `psychological_reports_ibfk_2` FOREIGN KEY (`session_id`) REFERENCES `chat_sessions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `risk_cases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `risk_cases` (
  `id` int NOT NULL AUTO_INCREMENT,
  `report_id` int NOT NULL,
  `risk_level` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `summary` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `handoff_summary` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `acknowledged_by` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `acknowledged_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_risk_cases_report_id` (`report_id`),
  KEY `ix_risk_cases_risk_level` (`risk_level`),
  KEY `ix_risk_cases_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tool_audit_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tool_audit_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `job_id` int DEFAULT NULL,
  `report_id` int DEFAULT NULL,
  `tool_name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `policy` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `allowed` tinyint(1) NOT NULL,
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_tool_audit_records_status` (`status`),
  KEY `ix_tool_audit_records_tool_name` (`tool_name`),
  KEY `ix_tool_audit_records_job_id` (`job_id`),
  KEY `ix_tool_audit_records_report_id` (`report_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tool_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tool_jobs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `report_id` int NOT NULL,
  `kind` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempts` int NOT NULL,
  `max_attempts` int NOT NULL,
  `depends_on_job_id` int DEFAULT NULL,
  `run_after` datetime NOT NULL,
  `last_error` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_tool_jobs_run_after` (`run_after`),
  KEY `ix_tool_jobs_status` (`status`),
  KEY `ix_tool_jobs_report_id` (`report_id`),
  KEY `ix_tool_jobs_kind` (`kind`),
  KEY `ix_tool_jobs_depends_on_job_id` (`depends_on_job_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `user_accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_accounts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `roles_csv` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_user_accounts_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
