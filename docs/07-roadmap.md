# 07 — Phased Roadmap

## সারসংক্ষেপ (বাংলায়)

চারটি Phase: **Phase 0 (MVP, ৩–৪ মাস)** — একটি Agent type, Knowledge upload → auto-train, Website Widget + Messenger, basic dashboard; লক্ষ্য: প্রথম paying customer। **Phase 1 (মাস ৫–৮)** — multi-agent, Learning Loop, Human Handoff, WhatsApp; লক্ষ্য: retention প্রমাণ। **Phase 2 (মাস ৯–১৪)** — enterprise readiness (RBAC গভীরতা, audit, SSO), Bangla voice, analytics; লক্ষ্য: বড় client। **Phase 3 (মাস ১৫+)** — Agent Actions (tool use), Marketplace, data residency; লক্ষ্য: "AI Workforce Platform" category দখল।

নীতি: **প্রতিটি Phase শেষে বিক্রয়যোগ্য product** — কোনো Phase শুধু "ভিত্তি বানানো" নয়।

---

## Phase 0 — MVP: "Train & Deploy" (মাস ১–৪)

> লক্ষ্য: একটি কোম্পানি signup করে নিজের document দিয়ে Agent বানিয়ে Website ও FB Page-এ চালু করতে পারবে — কোনো manual সাহায্য ছাড়া।

### Scope

| অন্তর্ভুক্ত | বাদ (পরে) |
|---|---|
| Org + Workspace + basic auth (email, Google) | RBAC-এর পূর্ণ ৫ role (শুধু Owner/Member) |
| ১টি Agent type: Support/Knowledge Agent | Sales playbook, multi-agent templates |
| Knowledge: PDF, DOCX, CSV/XLSX, Website URL, FAQ editor | API push sync, Notion/Drive connectors |
| Ingestion pipeline + Smart Retraining (hash-diff) | — (এটি core, বাদ নয়) |
| Agent persona config + Playground | A/B testing |
| Website Widget + FB Messenger | WhatsApp, Instagram, Telegram |
| RAG-only answering + citation + honest fallback | Confidence-tuned handoff (basic version থাকবে: unknown → email notify) |
| Unknown question log (Learning Loop-এর প্রথম অর্ধেক) | Semantic clustering |
| Basic dashboard: conversations, answer rate, unknown list | Full analytics |
| Billing: Stripe + SSLCommerz, Starter/Growth plan | Usage-based add-ons |
| RLS isolation + audit log table + encryption | SOC 2, SSO |

### Success Criteria
- Signup → live agent: **< ৩০ মিনিট, self-serve**
- Answer rate (knowledge-covered প্রশ্নে): > ৮৫%
- ১০টি pilot customer, তার মধ্যে ৩+ paying
- Cross-tenant isolation test suite: ১০০% pass

### Team (~৫ জন)
1× Full-stack lead (TS), 1× Backend (TS/NestJS), 1× AI engineer (Python/RAG), 1× Frontend (Next.js + Widget), 1× Founder/PM (+ part-time DevOps)

---

## Phase 1 — Retention: "Multi-Agent & Learning" (মাস ৫–৮)

> লক্ষ্য: Customer-রা থেকে যায় এবং plan upgrade করে — কারণ Agent প্রতিদিন ভালো হচ্ছে।

### Scope
- **Multi-agent** per workspace + agent templates (Sales/Support/Custom) — Growth plan (5 agents) এখন অর্থবহ
- **Learning Loop সম্পূর্ণ:** semantic clustering, pending questions UI, এক-ক্লিক answer → auto-learn ([04](04-agent-lifecycle.md) §7)
- **Human Handoff + Team Inbox:** confidence-based + user-requested trigger, realtime inbox, office hours ([04](04-agent-lifecycle.md) §8)
- **WhatsApp channel** (embedded signup) ([06](06-channels-gtm.md))
- **Lead capture + COD order flow** (state machine engine) ([06](06-channels-gtm.md) §3)
- Knowledge versioning UI + rollback
- RBAC পূর্ণ ৫ role ([03](03-multi-tenancy-security.md) §3)
- Outbound webhooks (lead, order, handoff events)

### Success Criteria
- Month-2 logo retention > ৮০%; Starter→Growth upgrade > ১৫%
- Learning loop ব্যবহারকারী org: > ৫০% (sticky feature প্রমাণ)
- ৫০+ paying customers

### Team: +১ Backend, +১ Support/Success = ~৭ জন

---

## Phase 2 — Enterprise-Ready & Bangla Moat (মাস ৯–১৪)

> লক্ষ্য: বড় BD client (bank, telco, hospital chain, university) সই করানো যায় এমন product; এবং Bangla-তে অপরাজেয়।

### Scope
- **Bangla Voice Agent:** voice message in → STT → RAG → TTS reply ([08](08-differentiators.md) §3)
- **Bangla Eval Suite** production-grade + model benchmark pipeline
- **Analytics dashboard সম্পূর্ণ:** funnel, agent performance, CSAT, cost per conversation
- **Enterprise security:** SSO (SAML/OIDC), SCIM, audit export, custom roles
- SOC 2 Type I; data deletion (GDPR-style)
- Performance hardening: read replicas, partitioning, Qdrant migration যদি trigger ছোঁয় ([05](05-tech-stack.md) §4)
- Instagram channel; courier integrations (Pathao/Steadfast/RedX)
- Suggested replies (AI assist for human agents in inbox)

### Success Criteria
- ২+ enterprise contract (annual)
- Voice feature adoption measurable; Bangla CSAT ≥ English CSAT
- 99.95% uptime ৩ মাস টানা

### Team: ~১০–১২ জন (devops dedicated, +AI, +sales)

---

## Phase 3 — AI Workforce Platform (মাস ১৫+)

> লক্ষ্য: Chatbot category ছেড়ে "Digital Employee" category-তে প্রবেশ — Agent এখন কাজ করে।

### Scope
- **Agent Actions (tool use):** Reasoning → Action → Answer। Stock check, order status lookup, discount apply, checkout link — allowlist-based tool framework ([03](03-multi-tenancy-security.md) §6, [08](08-differentiators.md) §6)। শুরু: HTTP tool (customer-এর API call) + built-in tools (order, lead, calendar)।
- **Agent Marketplace:** prebuilt agent packages (Ecommerce, Hospital, School, Law Firm, HR...) — template + knowledge schema + tools এক-ক্লিক deploy। Template গুলো Phase 0 থেকেই internal — এখন public + ভবিষ্যতে third-party submission।
- **Data residency** (per-region stacks) + dedicated DB enterprise tier
- Cross-channel identity merge; CRM-lite views
- Public API + developer docs (platform-on-platform)
- Global launch: English-first marketing, Stripe billing default

### Success Criteria
- Actions ব্যবহারকারী customer-দের retention/ARPU বাকিদের চেয়ে measurably বেশি
- Marketplace থেকে নতুন signup-এর % track
- প্রথম non-BD revenue

---

## Cross-Phase Engineering নীতি

1. **Walking skeleton প্রথম সপ্তাহে** — auth → upload → index → ask → answer পুরো পথ পাতলাভাবে চালু; তারপর প্রতিটি অংশ মোটা হয়।
2. প্রতি Phase-এ **isolation test suite ও eval suite** সবুজ থাকতে হবে — নতুন feature এগুলো ভাঙলে merge হয় না।
3. **Feature flag per org** — enterprise pilot-দের আগে দেওয়া, ধাপে ধাপে rollout।
4. Architecture-পরিবর্তন (Qdrant, module extraction, K8s) **শুধুই trigger-ভিত্তিক** ([02](02-system-architecture.md), [05](05-tech-stack.md)) — calendar-ভিত্তিক নয়।
