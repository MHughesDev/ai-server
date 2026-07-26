---
doc_id: "12.1"
title: "queue categories"
section: "Queue"
summary: "Registry of valid queue categories with descriptions, validation rules, and examples."
updated: "2026-04-17"
---

# 12.1 — queue categories

<!-- CROSS-REFERENCES -->
<!-- - Enforced by: queue/scripts/queue-validate.sh -->
<!-- - Procedure: queue/procedures/add-queue-category.md -->

**Purpose:** Registry of valid queue categories with descriptions, validation rules, and examples. Per spec §17.10 and §28.4 item 294.

## 12.1.1 Default Categories

Table of default queue categories. Columns: Category, Description, Example Summary. Rows:
| Category | Description | Example |
|----------|-------------|---------|
| core-api | API endpoint and business logic work | "Implement Invoice CRUD: router, service, models, tests. Acceptance criteria: all CRUD endpoints return correct status codes, tenant-scoped, integration tests pass." |
| infrastructure | Database, Docker, K8s, deployment | "Configure production PostgreSQL connection with connection pooling, health checks, and migration pipeline." |
| testing | Test additions and quality improvements | "Add integration test suite for auth module covering all edge cases." |
| documentation | Doc updates, runbooks, procedures | "Update API endpoint docs to reflect v1.1 schema changes." |
| bugfix | Bug fixes with regression tests | "Fix invoice total calculation overflow for amounts > $999,999.99." |
| refactor | Structure improvements without behavior change | "Extract repository layer from invoice service to separate file." |
| security | Security hardening, CVE fixes, auth changes | "Rotate JWT signing key and verify all sessions invalidated." |
| devops | CI/CD, monitoring, observability | "Add Prometheus metrics to API health endpoints." |

## 12.1.2 Adding a Category

Brief reference to queue/procedures/add-queue-category.md for the full procedure. Summary: update this file, update queue validator, add example to QUEUE_INSTRUCTIONS.md.
