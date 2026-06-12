# AI Agent OS — Multi-Tenant AI Agent Platform

> **"আমরা একটি Multi-Tenant AI Agent OS তৈরি করতে চাই যেখানে যেকোনো কোম্পানি কোড ছাড়া একাধিক AI Agent তৈরি, ট্রেন, ম্যানেজ এবং Website, Facebook, WhatsApp ও অন্যান্য চ্যানেলে ডিপ্লয় করতে পারবে; এবং ভবিষ্যতে এই Agent-গুলো শুধু প্রশ্নের উত্তর নয়, ব্যবসায়িক কাজও সম্পন্ন করবে।"**

এই Repository-তে আছে প্ল্যাটফর্মটির **Technical Architecture Proposal** — Product Vision (BRD)-এর জবাবে Developer Team-এর পূর্ণাঙ্গ Design Document সেট।

## Document Index

| # | Document | বিষয়বস্তু |
|---|----------|-----------|
| 01 | [Executive Summary](docs/01-executive-summary.md) | Vision, Positioning, মূল Architecture সিদ্ধান্তগুলোর TL;DR |
| 02 | [System Architecture](docs/02-system-architecture.md) | High-level Architecture, Component Design, ১০,০০০+ Tenant-এর Scalability Design |
| 03 | [Multi-Tenancy & Security](docs/03-multi-tenancy-security.md) | Org → Workspace → Agent Data Model, Data Isolation (RLS), RBAC, Audit Logs, Secrets |
| 04 | [Agent Lifecycle](docs/04-agent-lifecycle.md) | Create → Train → Deploy → Improve; Knowledge Pipeline, Smart Retraining, Learning Loop, Human Handoff |
| 05 | [Tech Stack](docs/05-tech-stack.md) | Recommended Stack + Trade-off Analysis; LLM Gateway, Vector DB Strategy, Hosting |
| 06 | [Channels & Go-to-Market](docs/06-channels-gtm.md) | Omnichannel Adapter Architecture, Channel Priority Analysis, COD Workflow |
| 07 | [Roadmap](docs/07-roadmap.md) | Phase 0 → 3 Roadmap; প্রতিটি Phase-এর Scope, Success Criteria, Team Size |
| 08 | [Differentiators](docs/08-differentiators.md) | Bangla-Native AI, Voice, Facebook Commerce, Competitor Mapping |
| 09 | [Product Requirements (PRD)](docs/09-product-requirements.md) | **Phase 0 Scope Freeze** — F1–F10 Functional Requirements, Acceptance Criteria, Golden Path |
| 10 | [Pricing & Unit Economics](docs/10-pricing-unit-economics.md) | Cost/reply Model, Plan-প্রতি Margin, Break-even, Cost Guardrails, LTV/CAC |
| 11 | [Evaluation Framework](docs/11-evaluation-framework.md) | Bangla Eval Suite (Golden Dataset), Scoring Pipeline, Release Gate, Model Benchmarking |
| 12 | [Observability & Monitoring](docs/12-observability-monitoring.md) | Logs/Traces/Metrics, Dashboards, Alerts + Runbooks, SLOs, Billing Metering Integrity |
| 13 | [Architecture Review](docs/13-architecture-review.md) | ৮টি Review Question-এর Baseline জবাব, Action Items (A1–A6), **🔒 Plan Lock v1.0** |
| 14 | [Sprint 0 Plan](docs/14-sprint-0-plan.md) | Walking Skeleton — Ticket Breakdown (S0-01…17), DoD, Sequencing, Scaffold↔Ticket Map |

## কীভাবে পড়বেন

- **Founder / Business:** শুরু করুন [01-executive-summary.md](docs/01-executive-summary.md) এবং [07-roadmap.md](docs/07-roadmap.md) দিয়ে; তারপর [10-pricing-unit-economics.md](docs/10-pricing-unit-economics.md)।
- **Engineering Lead:** [02-system-architecture.md](docs/02-system-architecture.md) → [03-multi-tenancy-security.md](docs/03-multi-tenancy-security.md) → [05-tech-stack.md](docs/05-tech-stack.md) → [09-product-requirements.md](docs/09-product-requirements.md)।
- **Product:** [09-product-requirements.md](docs/09-product-requirements.md) → [04-agent-lifecycle.md](docs/04-agent-lifecycle.md) → [06-channels-gtm.md](docs/06-channels-gtm.md) → [08-differentiators.md](docs/08-differentiators.md)।

## Development (Sprint 0 — Walking Skeleton)

```text
apps/api/         Core API — NestJS modular monolith (module boundary = docs/02 §2)
apps/web/         Dashboard + Playground — Next.js
services/ai/      AI Service — FastAPI (RAG, LLM Gateway, Ingestion)
packages/shared/  Cross-app types: NormalizedMessage, PLAN_LIMITS
db/migrations/    SQL migrations — 0001 = schema v0 + RLS
infra/terraform/  Cloud infra (placeholder — deploy পরে)
ops/runbooks/     RB-1…6 (docs/12 §3-এর সঙ্গী)
```

### Quickstart

```bash
cp .env.example .env            # তারপর ANTHROPIC_API_KEY বসান
docker compose up -d            # postgres+pgvector, redis-cache, redis-queue, minio
pnpm install
pnpm db:migrate                 # 0001_init — schema + RLS
pnpm dev                        # api :4000, web :3000
# AI service (আলাদা terminal):
cd services/ai && uv sync && uv run uvicorn app.main:app --port 8000
```

Sprint 0-র ticket breakdown, sequencing ও Definition of Done: **[docs/14-sprint-0-plan.md](docs/14-sprint-0-plan.md)**। প্রতিটি stub-এ `TODO(S0-xx)` মন্তব্য ticket-এর সাথে map করা।

## Status: 🔒 PLAN LOCKED — v1.0 (2026-06-12) · Sprint 0 in progress

ডকুমেন্ট সেট 01–14 locked; monorepo scaffold তৈরি — Sprint 0 ticket গুলো চলমান।

- Doc 01–08: Architecture (review সম্পন্ন — [13](docs/13-architecture-review.md))
- Doc 09: **Phase 0 Scope Freeze** — 07-এর সাথে অমিল হলে 09-ই authoritative; open decisions resolved
- Doc 10: Pricing & caps **approved**; মাসিক cost-ledger reconcile standing rule
- Doc 11–12: AI quality gate ও production ops — Phase 0 engineering-এর অংশ
- Doc 13: Review-এর জবাব + **A1–A6 action items** + Lock-এর শর্তাবলি

**পরিবর্তনের নিয়ম:** Scope/pricing/architecture বদল = সংশ্লিষ্ট ডকুমেন্টে PR + কারণ + Founder sign-off ([13 §Plan Lock](docs/13-architecture-review.md))। মৌখিক সিদ্ধান্ত গণ্য নয়।

> **Phase 0 = 1 Agent + PDF Upload + Website Widget + Messenger + Basic Dashboard. Nothing more.**
