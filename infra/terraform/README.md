# Infra (Terraform)

Placeholder — deploy Phase 0-র শেষ দিকে (Sprint 0 সম্পূর্ণ local: docker-compose)।

পরিকল্পনা ([02](../../docs/02-system-architecture.md) §5, [05](../../docs/05-tech-stack.md) §5):

- Region: **ap-southeast-1 (Singapore)**
- Modules: `network/`, `database/` (RDS Postgres + PgBouncer), `cache/` (ElastiCache ×2 — A1), `compute/` (ECS Fargate: api, ai, workers), `storage/` (S3 + CloudFront), `observability/`
- প্রতি module region-parameterized — Enterprise data residency ([03](../../docs/03-multi-tenancy-security.md) §2.4) মানে নতুন region-এ same stack apply
