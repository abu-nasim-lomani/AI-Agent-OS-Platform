# 12 — Observability & Monitoring

## সারসংক্ষেপ (বাংলায়)

Multi-tenant AI platform-এ তিনটি জিনিস একসাথে ভাঙে: **system** (latency, queue), **AI quality** (answer rate, hallucination), এবং **টাকা** (LLM cost)। এই ডকুমেন্ট তিনটিরই চোখ-কান: structured logging, end-to-end tracing, metric dashboards, alert rules, SLO এবং runbook-এর তালিকা। নীতি একটাই: **যা [10](10-pricing-unit-economics.md) আর [09](09-product-requirements.md)-এ promise করা হয়েছে, তা এখানে measurable** — নাহলে promise-গুলো কথার কথা।

---

## 1. তিন স্তম্ভ

### 1.1 Structured Logs

- সব service JSON log; প্রতিটি entry-তে বাধ্যতামূলক field: `trace_id`, `org_id`, `agent_id` (যেখানে প্রযোজ্য), `module`, `severity`।
- **PII নীতি:** end-user-এর message body default-এ log-এ যাবে **না**; debug-এর জন্য sampled prompt logging (১%) — মাস্কড (phone/email regex-redacted), ৭ দিন retention। পূর্ণ conversation থাকে DB-তে (encrypted), log-এ নয়। ([03](03-multi-tenancy-security.md) §6.3)
- Retention: app log ৩০ দিন hot, ৯০ দিন cold; audit log আলাদা ব্যবস্থা ([03](03-multi-tenancy-security.md) §4)।

### 1.2 Distributed Tracing (OpenTelemetry)

এক message-এর পুরো জীবন এক trace-এ:

```text
[Channel webhook/WS] → [Core: Conversations] → [AI Service: retrieve]
→ [pgvector query] → [LLM Gateway: provider call (+fallback?)] → [Channel reply]
```

প্রতিটি span-এ duration + status; LLM span-এ অতিরিক্ত attribute: model, prompt version, input/output/cached tokens, cost। **"উত্তর slow কেন"** প্রশ্নের জবাব এক trace দেখে পাওয়া যাবে — অনুমানে নয়।

### 1.3 Metrics

| গ্রুপ | মূল metric |
|---|---|
| System | Request rate, error rate, latency p50/p95/p99 (per service), queue depth + job age (per workload class), DB connections, Redis memory |
| AI | Answer rate, unknown rate, retrieval score distribution, **cache hit rate** (`cache_read_tokens > 0` ratio), groundedness sampling score ([11](11-evaluation-framework.md) §5), provider fallback count |
| Business/Cost | Cost per reply (per org, per model tier), daily LLM spend (org + global), tokens/reply p50/p95, cap utilization per org, active orgs/agents |

---

## 2. Dashboards (চারটি, এর বেশি নয় — Phase 0)

1. **System Health** — golden signals per service + queue + DB। দর্শক: engineer।
2. **AI Quality** — answer rate trend, unknown rate, fallback events, eval nightly score। দর্শক: AI engineer + founder।
3. **Cost** — global দৈনিক LLM spend, top-10 org by cost, cost/reply trend বনাম [10](10-pricing-unit-economics.md)-এর $0.004 budget line, cache hit rate। দর্শক: founder (সপ্তাহে একবার বাধ্যতামূলক দর্শন)।
4. **Funnel** — [09](09-product-requirements.md) §6-এর activation funnel (signup → live)। দর্শক: product/founder।

---

## 3. Alerts

নীতি: **প্রতিটি alert actionable** — যে alert-এ কেউ কিছু করে না, সেটি মুছে ফেলা হবে (alert fatigue = অন্ধত্ব)।

| Severity | Condition | Action / Runbook |
|---|---|---|
| 🔴 Page | API error rate > 5% (৫ মিনিট) | RB-1: rollback/restart path |
| 🔴 Page | LLM primary provider failure এবং fallback-ও ব্যর্থ | RB-2: tier remap / status page |
| 🔴 Page | DB primary down / failover ঘটেছে | RB-3 |
| 🔴 Page | **Global দৈনিক LLM spend projected > 2× budget** | RB-4: cost kill-switch পথ |
| 🟡 Ticket | Queue job age p95 > 10 মিনিট (ingestion) | RB-5: worker scale / poison job |
| 🟡 Ticket | Per-org daily budget cap ছুঁয়েছে ([09](09-product-requirements.md) F10.3 trigger হয়েছে) | যাচাই: abuse না legit growth → upsell |
| 🟡 Ticket | Cache hit rate < 50% (১ ঘণ্টা) | Silent cache invalidator খোঁজা ([10](10-pricing-unit-economics.md) §1) |
| 🟡 Ticket | Provider fallback rate > 10% | Provider status / key pool check |
| 🟡 Ticket | Answer rate (global) ১০ পয়েন্ট নেমেছে দৈনিক গড় থেকে | Regression? নতুন org-এর খারাপ knowledge? |
| 🟡 Ticket | Meta webhook delivery failure streak | RB-6: token expiry / app review status |
| 🟢 Log-only | একক org-এর unknown rate spike | সাপ্তাহিক review-তে |

---

## 4. SLOs (Phase 0)

| SLO | Target | মাপা হয় |
|---|---|---|
| Chat answer latency (end-to-end, LLM-সহ) | p95 < 6s | Trace root span |
| Widget asset load | p95 < 1s | CDN/RUM |
| Uptime (chat path) | 99.5% | Synthetic probe (প্রতি মিনিটে test question, dedicated probe org) |
| Ingestion: ৫০-পাতার PDF → Trained | p95 < 5 মিনিট | Pipeline span |
| Webhook (Messenger) processing | p95 < 2s (আমাদের অংশ) | Adapter span |

Synthetic probe-টি গুরুত্বপূর্ণ: **customer-এর আগে আমরা জানব** chat path ভেঙেছে কি না।

---

## 5. Billing Metering Integrity

[10](10-pricing-unit-economics.md)-এর পুরো economics দাঁড়িয়ে আছে usage ledger-এর সততার উপর, তাই:

- প্রতিটি LLM call-এর usage **provider response থেকে** নেওয়া হবে (নিজে অনুমান নয়); gateway-তে এক জায়গায় record।
- দৈনিক reconciliation job: ledger-এর যোগফল বনাম provider billing dashboard-এর সংখ্যা — গরমিল > 5% হলে 🟡 alert।
- মাসিক: ledger বনাম [10](10-pricing-unit-economics.md)-এর মডেল reconcile (standing rule, ওই ডকুমেন্টের §8.3)।

---

## 6. Operations ছন্দ (Phase 0 — ছোট টিমের বাস্তবতা)

- **On-call lite:** ব্যবসা-সময়ে (৯টা–১১টা) সবাই; রাতে শুধু 🔴 page (rotation: ২ জন)। 99.5% SLO এতে রক্ষণীয়; 99.9%-এ গেলে ([07](07-roadmap.md) Phase 2) প্রকৃত rotation।
- **সাপ্তাহিক ops review (৩০ মিনিট):** dashboard 1–3 + গত সপ্তাহের alert গুলো — প্রতিটির either fix or alert-rule মুছা।
- **Incident নীতি:** customer-প্রভাবী incident → ২৪ ঘণ্টায় ছোট postmortem (blameless, template repo-তে); runbook আপডেট সেই PR-এই।
- **Runbook তালিকা (RB-1…6):** repo-র `ops/runbooks/`-এ; প্রতিটি alert rule-এর সাথে runbook link বাধ্যতামূলক — link-হীন alert merge হবে না।

---

## 7. Tooling সিদ্ধান্ত

| Layer | Phase 0 | নোট |
|---|---|---|
| Instrumentation | OpenTelemetry SDK (TS + Python) | Vendor-নিরপেক্ষ — পরে backend বদলানো যায় |
| Backend | Managed (Axiom / Grafana Cloud / Datadog — খরচ তুলনা করে একটি) | Self-hosted Grafana stack Phase 0-তে ops-ভার; trigger-এ migrate |
| Uptime probe | Managed synthetic (Checkly-class) বা ছোট cron | |
| Error tracking | Sentry-class | Frontend (widget!) + backend দুটোই |

Widget-এর error tracking আলাদা গুরুত্বে: customer-এর site-এ আমাদের bundle ভাঙলে customer টের পাওয়ার আগে আমাদের জানা চাই।
