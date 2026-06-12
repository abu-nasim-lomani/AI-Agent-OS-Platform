# 13 — Architecture Review: ৮টি প্রশ্নের Baseline জবাব

## সারসংক্ষেপ (বাংলায়)

Development শুরুর আগে Developer Team-কে যে ৮টি Architecture Review Question দেওয়া হয়েছিল — এই ডকুমেন্ট তার baseline জবাব। Review meeting-এ টিম এগুলো challenge করবে; যে জবাব টিকবে না, সংশ্লিষ্ট ডকুমেন্ট সংশোধিত হবে। প্রতিটি জবাবে আছে: রায়, যুক্তি, **কী প্রথমে ভাঙবে**, এবং কোন metric সেটি আগেভাগে ধরবে।

---

## Q1 — 10k Tenant Reality Check

**রায়: Architecture টিকবে; প্রথম ভাঙবে operations-discipline, technology নয়।**

[02](02-system-architecture.md) §3.2-এর capacity model: ১০k tenant ≈ peak ~৫০ msg/sec, ৬০M vectors, 1M LLM call/day — কোনোটিই exotic scale নয়। তবে সততার সাথে, ভাঙার সম্ভাব্য ক্রম:

1. **Postgres connection exhaustion** (সবচেয়ে আগে) — প্রতি request `SET LOCAL` transaction-এ চালাতে হয়, connection চাহিদা বাড়ে। প্রতিকার আগে থেকে নকশায়: PgBouncer **transaction-mode** pooling Day 1 (নিচে Q2-ও দেখুন)। Early-warning metric: DB connection utilization > 70%।
2. **Noisy-neighbor ingestion** — এক tenant-এর বিশাল upload অন্যের training slow করা। প্রতিকার designed: per-tenant queue concurrency cap ([02](02-system-architecture.md) §3.1)। Metric: queue job age p95 per tenant।
3. **LLM provider rate limit** — আমাদের bottleneck নয়, provider-এর। প্রতিকার: multi-key pool + multi-provider fallback ([05](05-tech-stack.md) §3)।

সত্যিকারের ফাঁক: ১০k-এ পৌঁছানোর পথে module extraction ও partitioning-এর **trigger discipline** মানা — সেগুলো ডকুমেন্টেড ([02](02-system-architecture.md) §1, §3.3), কিন্তু মানা টিমের কাজ।

---

## Q2 — RLS Strategy Validation

**রায়: সঠিক default; তিনটি সূক্ষ্ম ফাঁদ আছে, তিনটিরই প্রতিকার নির্ধারিত।**

1. **Pooling ফাঁদ:** `SET app.current_org_id` session-scoped হলে pooled connection-এ tenant context leak করতে পারে। প্রতিকার: সর্বদা `SET LOCAL` (transaction-scoped) + PgBouncer transaction mode + ORM middleware-এ কেন্দ্রীয়ভাবে enforce (হাতে কোথাও `SET` লেখা নিষেধ)।
2. **Performance ফাঁদ:** RLS policy-র সাথে index না মিললে seq-scan। প্রতিকার: প্রতিটি tenant-scoped table-এ composite index `(org_id, ...)` leading column হিসেবে — migration lint এটি যাচাই করবে।
3. **Coverage ফাঁদ:** নতুন table-এ policy ভুলে যাওয়া। প্রতিকার designed: CI check — RLS-হীন tenant-table থাকলে migration fail + cross-tenant test suite ([03](03-multi-tenancy-security.md) §2.3)।

Overhead বাস্তবে: সঠিক index-সহ RLS predicate ~negligible (এক যোগ-শর্ত)। Benchmark Phase 0 sprint 1-এ একবার মেপে baseline রাখা হবে।

---

## Q3 — Queue Strategy Validation

**রায়: Redis + BullMQ যথেষ্ট ও সঠিক; Kafka এখন কেনা মানে জটিলতা কেনা।**

- প্রয়োজনীয় throughput (ingestion + webhook + notification) BullMQ-র ক্ষমতার বহু নিচে।
- দুটি শর্ত মানতে হবে: (১) **Job idempotency** — প্রতিটি job retry-safe, idempotency key-সহ ([02](02-system-architecture.md) §4-এর নীতির queue-রূপ); (২) **Redis durability** — queue-Redis-এ AOF persistence + আলাদা instance (cache-Redis eviction-যুক্ত, queue-Redis নয় — দুটো এক instance-এ রাখা নিষেধ, [05](05-tech-stack.md)-এ "পরে আলাদা" বলা ছিল; review রায়: queue আলাদা **Day 1**)।
- Poison job: max-retry → dead-letter queue → 🟡 alert ([12](12-observability-monitoring.md) §3)।
- Kafka trigger অপরিবর্তিত: event volume/replay-চাহিদা দাবি করলে ([05](05-tech-stack.md))।

**ডকুমেন্ট সংশোধন:** [05](05-tech-stack.md)-এর "same cluster, পরে আলাদা" → queue-Redis Day 1 থেকেই আলাদা। (এই review-এর একমাত্র design পরিবর্তন।)

---

## Q4 — pgvector Limit Analysis

**রায়: Phase 0–1-এর scale-এ প্রশ্নাতীত; ১০k-tenant দিগন্তে মূল ঝুঁকি query latency নয় — index build ও OLTP contention।**

- Phase 0 বাস্তবতা: শত tenant × ~২k chunk = কয়েক লক্ষ vector — pgvector হাসতে হাসতে পারে।
- ৬০M-এ (১০k tenant): HNSW index-এর build/maintenance memory-ক্ষুধার্ত এবং vector workload OLTP-র সাথে CPU/IO লড়াই করে। প্রতিকার পথ ডকুমেন্টেড: প্রথমে read-replica-তে vector query সরানো → তারপর Qdrant ([05](05-tech-stack.md) §4-এর তিন trigger)।
- Per-agent filter (`agent_id`) HNSW-এর সাথে post-filter হলে recall ঝুঁকি — তাই chunk table partitioning কৌশল ও `agent_id`-aware indexing sprint 1-এ POC করে benchmark করা হবে (এটি review-এর একটি **action item**)।
- Insurance অপরিবর্তিত: `VectorStore` interface Day 1 — migration dual-write path।

---

## Q5 — LLM Gateway Design Review

**রায়: পাতলা নিজস্ব wrapper + ভেতরে LiteLLM — সঠিক; চারটি ঝুঁকিতে contract-test বাধ্যতামূলক।**

1. **Provider behavior drift** (একই "chat" API, ভিন্ন semantics: streaming, tool-call format, error shape) — প্রতি adapter-এ contract test suite: একই canonical request → প্রত্যাশিত normalized response।
2. **Fallback semantics:** ভিন্ন provider-এ একই prompt ভিন্ন মানের উত্তর দেয় — fallback-এ গেলে seamless ভান না করে log + metric ([12](12-observability-monitoring.md) §1.3 fallback count); eval suite-এ fallback-model-ও scored ([11](11-evaluation-framework.md) §4)।
3. **Usage/token accounting:** provider-ভেদে usage field ভিন্ন — ledger সবসময় provider-reported usage থেকে, normalized এক জায়গায় ([12](12-observability-monitoring.md) §5)।
4. **LiteLLM নিজেই dependency:** আমাদের wrapper interface-টিই সত্য — LiteLLM বদলালে wrapper-এর নিচে বদলায়, উপরে কেউ টের পায় না ([05](05-tech-stack.md) §3-এ designed)।

Cost metering, budget kill-switch, model-tier gate — তিনটিই **gateway-তে কেন্দ্রীভূত** থাকায় [10](10-pricing-unit-economics.md)-এর guardrail এক জায়গায় enforce হয় — এটি design-এর শক্তি, রক্ষা করতে হবে (কেউ যেন gateway bypass করে সরাসরি provider SDK না ডাকে — lint rule)।

---

## Q6 — Learning Loop Complexity Review

**রায়: Phase 0 অংশ trivial — engineering ঝুঁকি নেই; Phase 1 clustering মাঝারি, ML-infra লাগে না।**

- Phase 0 ([09](09-product-requirements.md) F8): unknown log + list + এক-ক্লিক FAQ answer + auto re-index — সবগুলো বিদ্যমান pipeline-এর পুনর্ব্যবহার। **জটিলতা কম, retention-মূল্য সর্বোচ্চ — অনুপাতটাই এটিকে Phase 0-তে রাখার যুক্তি।**
- Phase 1 semantic clustering: unknown question-গুলোর embedding (আগে থেকেই আছে) + cosine threshold greedy clustering — আলাদা ML system নয়, একটি worker job। ঝুঁকি cluster quality (ভুল প্রশ্ন এক cluster-এ) — প্রতিকার: cluster শুধু **suggestion**, admin merge/split পারবে; মানুষ loop-এ থাকায় ভুলের দাম কম।
- সতর্কতা একটিই: admin-এর দেওয়া উত্তর knowledge-এ ঢোকে অর্থাৎ admin ভুল শেখালে Agent ভুল শিখবে — এটি feature-এর স্বভাব, bug নয়; version rollback ([04](04-agent-lifecycle.md) §3) safety net।

---

## Q7 — Messenger API Risk Review

**রায়: ঝুঁকি বাস্তব কিন্তু পরিচিত ও পরিচালনাযোগ্য; সবচেয়ে বড়টি technical নয় — Meta app review-র timeline।**

| ঝুঁকি | মাত্রা | প্রতিকার |
|---|---|---|
| App review বিলম্ব/প্রত্যাখ্যান | **উচ্চ (schedule)** | Sprint 1-এই submission ([09](09-product-requirements.md) F7.5); fallback: pilot customer dev-app tester (গৃহীত সিদ্ধান্ত, নিচে Lock §) |
| Page token expiry/invalidation | মাঝারি | Token health monitor + auto-refresh + expiry alert ([12](12-observability-monitoring.md) §3 RB-6) |
| Meta policy পরিবর্তন (messaging window, pricing) | মাঝারি, দীর্ঘমেয়াদি | Adapter isolation ([06](06-channels-gtm.md) §1) — Messenger ভাঙলেও Core/Widget অক্ষত; এ কারণেই Widget+Messenger জোড়া কৌশল, একক-চ্যানেল নির্ভরতা নয় |
| 24-hour messaging window নীতি | কম (আমাদের use case inbound-reply) | Outbound-initiated message Phase 0-তে নেই-ই; ভবিষ্যৎ broadcast feature-এ message-tag নীতি মানতে হবে |
| Webhook flood/replay | কম | Signature verify + idempotency key (F7.2, [02](02-system-architecture.md) §4) |

---

## Q8 — Cost Model Validation

**রায়: [10](10-pricing-unit-economics.md)-এর মডেল গঠনগতভাবে সঠিক; দুর্বলতম অনুমান দুটি — সেগুলোই প্রথম ৩০ দিনে মাপা হবে।**

1. **Tokens/reply (3,000 in / 250 out):** Bangla tokenization English-এর চেয়ে token-ঘন হতে পারে — বাস্তব সংখ্যা ±৩০% হলে margin table নড়ে। তাই F10.5 ledger-এ tokens/reply p50/p95 প্রথম দিন থেকে; pilot-এর প্রথম মাসে মডেল reconcile (standing rule)।
2. **Cap-এর ৬০% গড় usage:** অনুমান, data নয় — pilot-এ মাপা হবে; বেশি হলে cap/দাম নয়, আগে caching ও context discipline (guardrail #4, #6) টাইট হবে।
3. মডেলের শক্ত দিক review-তে টিকেছে: worst-case-ও (১০০% cap, uncached) কোনো plan লোকসানে নয় — অর্থাৎ ভুল অনুমানে কোম্পানি ডোবে না, শুধু margin কমে। এটাই cap-ভিত্তিক design-এর মূল্য।

---

## Review Action Items

| # | Action | কোথায় | কখন |
|---|---|---|---|
| A1 | Queue-Redis Day 1 থেকে আলাদা instance | [05](05-tech-stack.md) সংশোধন (এই ডক-এ recorded) | Sprint 0 (infra) |
| A2 | pgvector + `agent_id` filter benchmark POC | Engineering spike | Sprint 1 |
| A3 | RLS + PgBouncer transaction-mode overhead benchmark | Engineering spike | Sprint 1 |
| A4 | Meta app review submission | F7.5 | Sprint 1 |
| A5 | LLM Gateway adapter contract-test suite skeleton | AI Service | Sprint 1–2 |
| A6 | Gateway-bypass lint rule (সরাসরি provider SDK call নিষেধ) | CI | Sprint 1 |

---

## 🔒 Plan Lock (v1.0 — 2026-06-12)

ডকুমেন্ট সেট 01–13 **locked**। সাথে [09](09-product-requirements.md) §7-এর open decision-গুলো নিম্নরূপে **গৃহীত**:

1. Free Trial = ১৪ দিন / ২০০ AI reply।
2. "Powered by" branding Free ও Starter-এ থাকবে; Growth+ এ removable।
3. Meta review বিলম্বে pilot customer-দের dev-app tester হিসেবে onboard করা গ্রহণযোগ্য।

এবং [10](10-pricing-unit-economics.md) §8-এর pricing, cap ও standing reconcile rule **অনুমোদিত**।

**পরিবর্তনের নিয়ম (lock-এর অর্থ):** Phase 0 চলাকালীন scope/pricing/architecture-সিদ্ধান্ত বদলাতে হলে — সংশ্লিষ্ট ডকুমেন্টে PR + কারণ + Founder sign-off; মৌখিক/চ্যাট সিদ্ধান্ত গণ্য হবে না। Bug-fix-মাত্রার সংশোধন (টাইপো, লিংক) ব্যতিক্রম।

**পরবর্তী ধাপ:** Sprint 0 (infra + walking skeleton, [07](07-roadmap.md) cross-phase নীতি #1) → A1–A6 action items → Phase 0 build।
