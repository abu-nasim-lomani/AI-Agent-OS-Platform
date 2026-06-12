# 09 — Product Requirements Document (PRD): Phase 0

## সারসংক্ষেপ (বাংলায়)

এই PRD শুধুমাত্র **Phase 0 (MVP)**-এর জন্য — এবং এটি একটি **Scope Freeze ডকুমেন্ট**। [07-roadmap.md](07-roadmap.md)-এর Phase 0 scope-কে এখানে আরও সংকুচিত করা হয়েছে; দুটির মধ্যে অমিল হলে **এই ডকুমেন্টই authoritative**। Phase 0-এর একমাত্র লক্ষ্য: একটি কোম্পানি নিজে নিজে signup করে, PDF upload করে, Website Widget ও Facebook Messenger-এ একটি কার্যকর AI Agent চালু করতে পারবে — ৩০ মিনিটের মধ্যে। এর বাইরে **কিছুই না**।

> **Phase 0 = 1 Agent + PDF Upload + Website Widget + Messenger + Basic Dashboard. Nothing more.**

---

## 1. Scope Freeze

### 1.1 IN (এই PRD-তে যা আছে, শুধু তাই বানানো হবে)

| # | Feature | Section |
|---|---------|---------|
| F1 | Signup, Org creation, Basic auth | §4.1 |
| F2 | Agent creation wizard (১টি agent, ১টি type) | §4.2 |
| F3 | Knowledge: PDF upload + Manual FAQ entry | §4.3 |
| F4 | Training pipeline + Smart Retraining (hash-diff) | §4.4 |
| F5 | Playground (test chat) | §4.5 |
| F6 | Website Widget channel | §4.6 |
| F7 | Facebook Messenger channel | §4.7 |
| F8 | Conversations view + Unknown Questions list | §4.8 |
| F9 | Basic Dashboard metrics | §4.9 |
| F10 | Plan limits + Billing Lite | §4.10 |

### 1.2 OUT (Frozen — Phase 0-তে কেউ এগুলো ছোঁবে না)

| বাদ পড়া Feature | কোন Phase-এ | নোট |
|---|---|---|
| DOCX / XLSX / CSV upload | Phase 0.5 (fast-follow) | Parser ভিন্ন; PDF-ই ৮০% case কভার করে |
| Website URL crawl | Phase 0.5 | Crawl + scheduled re-crawl জটিলতা |
| Multi-agent per org | Phase 1 | Data model-এ সমর্থন থাকবে, UI-তে নয় |
| Agent templates (Sales/Custom) | Phase 1 | Phase 0-তে একটিই type: Support/Knowledge |
| WhatsApp, Instagram, Telegram | Phase 1–3 | [06](06-channels-gtm.md) |
| Human Handoff + Team Inbox | Phase 1 | Phase 0 fallback: unknown হলে honest "জানি না" + admin email notify |
| Learning Loop-এর semantic clustering | Phase 1 | Phase 0-তে শুধু raw unknown list |
| COD order flow, Lead capture form | Phase 1 | |
| RBAC ৫ role | Phase 1 | Phase 0: শুধু Owner + Member |
| Voice, Analytics deep-dive, API, Webhooks | Phase 2+ | |
| Automated billing (Stripe/SSLCommerz) | Phase 0.5–1 | §4.10 — প্রথম ১০ customer manual invoice |
| Marketplace, Agent Actions | Phase 3 | |

**নিয়ম:** এই তালিকার কিছু বানাতে হলে আগে এই ডকুমেন্ট আপডেট হবে, Founder sign-off লাগবে। "ছোট জিনিস, করে ফেলি" — নিষিদ্ধ।

---

## 2. Personas

| Persona | কে | Phase 0-তে কী করে |
|---|---|---|
| **Owner (Admin)** | SME মালিক / ম্যানেজার — অল্প technical, Facebook Page চালায়, হয়তো WordPress site আছে | Signup, agent setup, PDF upload, unknown question-এর উত্তর দেওয়া, dashboard দেখা |
| **Member** | Owner-এর সহকর্মী | Owner-এর প্রায় সব (billing ও member management ছাড়া) |
| **End User** | Customer — Widget বা Messenger-এ প্রশ্ন করে | প্রশ্ন → উত্তর; Bangla / English / Banglish — তিনটিই |

---

## 3. Phase 0 Golden Path (Success Definition)

```text
Signup → Business info → PDF upload → Training (auto) → Playground-এ test
→ Widget embed code copy অথবা FB Page connect → Live
```

**পুরো পথ self-serve, ৩০ মিনিটের মধ্যে।** এটাই Phase 0-এর definition of done — প্রতিটি sprint review-তে এই পথ ধরে demo হবে।

**Business success criteria (Phase 0 শেষে):**
- ১০টি pilot customer onboard, **৩+ paying**
- Answer rate (knowledge-covered প্রশ্নে) > ৮৫%
- Signup → live median time < ৩০ মিনিট (instrumented, অনুমান নয়)

---

## 4. Functional Requirements

প্রতিটি requirement-এর ID আছে (যেমন F3.2) — engineering ticket ও test case এই ID reference করবে।

### F1 — Signup & Organization

**User story:** একজন business owner হিসেবে আমি email বা Google দিয়ে signup করে আমার কোম্পানির workspace পেতে চাই।

| ID | Requirement |
|---|---|
| F1.1 | Email+password এবং Google OAuth signup; email verification বাধ্যতামূলক |
| F1.2 | Signup-এ Org auto-create হবে; Business info form: Company name, Industry (dropdown), Website (optional), Language preference (Bangla/English/Both), Country |
| F1.3 | Owner অন্য user-কে email invite করতে পারবে (role: Member) |
| F1.4 | প্রতিটি Org-এর data RLS দিয়ে isolated ([03](03-multi-tenancy-security.md)) — Phase 0 থেকেই, পরে retrofit নয় |
| F1.5 | Workspace concept data model-এ থাকবে (প্রতি org-এ ১টি default workspace auto-create) কিন্তু UI-তে invisible |

**Acceptance:** নতুন user ৩ মিনিটে signup → verified → empty dashboard-এ পৌঁছায়। Cross-tenant isolation test suite pass।

### F2 — Agent Creation Wizard

**User story:** Owner হিসেবে আমি ধাপে ধাপে আমার Agent বানাতে চাই, technical কিছু না বুঝেই।

| ID | Requirement |
|---|---|
| F2.1 | প্রতি Org-এ Phase 0-তে **সর্বোচ্চ ১টি Agent** (DB-তে সীমা নেই, UI/API-তে enforce) |
| F2.2 | Wizard steps: ① Agent name + welcome message ② Personality (Professional / Friendly / Corporate — ৩টিই যথেষ্ট) + ভাষা (Bangla / English / Auto-match) ③ Knowledge upload (F3) ④ Test (F5) ⑤ Deploy (F6/F7) |
| F2.3 | Agent-এর behavior config versioned (`agent_versions`) — [04](04-agent-lifecycle.md) §2 |
| F2.4 | Wizard মাঝপথে ছাড়লে draft সংরক্ষিত থাকবে; ফিরে এসে continue |

**Acceptance:** Wizard সম্পূর্ণ করতে কোনো ধাপে documentation পড়া লাগে না; প্রতিটি ধাপে বাংলা+English microcopy।

### F3 — Knowledge Sources

**User story:** Owner হিসেবে আমি আমার price list / FAQ / policy-র PDF upload করব এবং কিছু প্রশ্নোত্তর নিজে টাইপ করব।

| ID | Requirement |
|---|---|
| F3.1 | PDF upload: একসাথে একাধিক, প্রতি file ≤ 25 MB, প্রতি agent মোট ≤ 100 MB (plan অনুযায়ী) |
| F3.2 | PDF parsing layout-aware হতে হবে — table (price list!) ভেঙে গেলে চলবে না; Bangla text extraction শুদ্ধ হতে হবে (এটি acceptance-blocking) |
| F3.3 | Manual FAQ editor: Question + Answer pair যোগ/সম্পাদনা/মুছা; এগুলো structured knowledge entry ([04](04-agent-lifecycle.md) §3) |
| F3.4 | প্রতিটি source-এর status দেখা যাবে: Uploading → Processing → Trained / Failed (error message-সহ) |
| F3.5 | Source delete করলে সংশ্লিষ্ট knowledge পরের re-index-এ বাদ যাবে |
| F3.6 | Scanned (image-only) PDF: Phase 0-তে reject + পরিষ্কার error ("এই PDF-এ text নেই") — OCR পরে |

**Acceptance:** ৫০-পাতার মিশ্র (Bangla+English, table-সহ) PDF upload → ৫ মিনিটের মধ্যে Trained; table-এর data প্রশ্ন করলে সঠিক উত্তর।

### F4 — Training Pipeline & Smart Retraining

**User story:** Owner হিসেবে নতুন PDF দিলে Agent নিজে নিজে আপডেট হবে — আমাকে কিছু বুঝতে হবে না।

| ID | Requirement |
|---|---|
| F4.1 | Pipeline: Upload → S3 → Queue → Parse → Chunk (heading-aware) → Hash-diff → Embed (শুধু নতুন/বদলানো chunk) → Index → Version bump ([04](04-agent-lifecycle.md) §3–4) |
| F4.2 | পুরোটা async; training চলাকালীন আগের version-এ Agent চালু থাকবে (zero-downtime atomic flip) |
| F4.3 | প্রতিটি chunk-এ metadata: source file, page — উত্তরের সাথে citation দেখানোর জন্য |
| F4.4 | Embedding model version knowledge-version-এ pinned ([05](05-tech-stack.md) §3) |
| F4.5 | Training fail হলে: dashboard-এ error + retry button; Agent আগের অবস্থায় অক্ষত |
| F4.6 | Per-tenant ingestion concurrency cap (noisy neighbor রোধ, [02](02-system-architecture.md) §3.1) |

**Acceptance:** একই PDF-এর সামান্য-সম্পাদিত নতুন version upload করলে শুধু পরিবর্তিত chunk re-embed হয় (log-এ যাচাইযোগ্য) এবং Agent অনলাইনই থাকে।

### F5 — Playground

| ID | Requirement |
|---|---|
| F5.1 | Dashboard-এর ভেতরে test chat — production-এর হুবহু path (same RAG, same prompt, same model) |
| F5.2 | প্রতিটি উত্তরের সাথে debug info (শুধু playground-এ): retrieved chunks + scores + citation |
| F5.3 | Playground conversation analytics/billing-এ গণনা হবে না |

**Acceptance:** Playground-এর উত্তর আর live channel-এর উত্তর একই প্রশ্নে identical।

### F6 — Website Widget

**User story:** Owner হিসেবে একটি script tag paste করেই আমার site-এ chat bubble চাই।

| ID | Requirement |
|---|---|
| F6.1 | Embed: একটি `<script>` snippet — copy-paste, ব্যস। Async load, host page block করবে না |
| F6.2 | Bundle ≤ 50 KB gzipped, CDN-served ([05](05-tech-stack.md)); host page-এর CSS-এর সাথে conflict-free (shadow DOM) |
| F6.3 | Customization: primary color, agent name, welcome message, position (left/right) |
| F6.4 | Domain allowlist — embed key অন্য site-এ কাজ করবে না |
| F6.5 | Visitor session: page reload-এ conversation টিকে থাকবে (একই browser, localStorage) |
| F6.6 | Rate limit: per-session + per-IP; দুর্ব্যবহারে CAPTCHA escalation ([03](03-multi-tenancy-security.md) §6) |
| F6.7 | Mobile responsive; Bangla font সঠিক rendering |

**Acceptance:** WordPress, raw HTML এবং Shopify — তিন ধরনের site-এ paste করে কাজ করে; Lighthouse-এ host page-এর score-এ উল্লেখযোগ্য অবনতি নেই।

### F7 — Facebook Messenger

**User story:** Owner হিসেবে আমার FB Page connect করলেই Page-এর inbox-এ Agent উত্তর দেবে।

| ID | Requirement |
|---|---|
| F7.1 | "Connect Facebook Page" OAuth flow → page list → select → done। Token encrypted at rest |
| F7.2 | Inbound: webhook verify (signature) → normalized message ([06](06-channels-gtm.md) §1); Outbound: text + quick replies |
| F7.3 | Page-এর human admin নিজে reply করলে Agent সেই conversation-এ ২৪ ঘণ্টা চুপ থাকবে (manual takeover detection) — এটি Phase 1 handoff-এর সরলতম রূপ এবং Phase 0-তে অপরিহার্য, কারণ BD-র Page owner-রা নিজেরাও inbox চালায় |
| F7.4 | Attachment (ছবি/voice) এলে Phase 0 আচরণ: ভদ্র fallback ("এই মুহূর্তে আমি শুধু text বুঝি") + conversation-এ সংরক্ষণ |
| F7.5 | Meta app review-র জন্য প্রয়োজনীয় permission-এর ন্যূনতম সেট (`pages_messaging`, `pages_show_list`); review submission Phase 0 sprint 1-এই শুরু হবে (lead time ঝুঁকি) |

**Acceptance:** Test Page-এ connect → end-to-end message round-trip < ৫ সেকেন্ড p95; owner reply করলে bot চুপ।

### F8 — Conversations & Unknown Questions

| ID | Requirement |
|---|---|
| F8.1 | সব conversation-এর তালিকা (channel, সময়, message count, preview) + full transcript view |
| F8.2 | **Unknown Questions list:** Agent যেসব প্রশ্নের উত্তর পারেনি (low confidence / no retrieval) — সময়ক্রম অনুযায়ী raw list ([04](04-agent-lifecycle.md) §7-এর Phase 0 subset) |
| F8.3 | Unknown question-এর পাশে "Answer" button → FAQ entry form (প্রশ্ন pre-filled) → save করলেই auto re-index → Agent শিখে গেল। **এটিই Learning Loop-এর বীজ এবং Phase 0-র সবচেয়ে গুরুত্বপূর্ণ retention feature — বাদ দেওয়া যাবে না** |
| F8.4 | দৈনিক digest email: গতকালের unknown question count + link |
| F8.5 | End-user message-এ Agent-এর আচরণ যখন উত্তর জানে না: honest fallback — "এই তথ্যটি এই মুহূর্তে আমার কাছে নেই" + (config অনুযায়ী) phone/email contact line। **কখনো বানিয়ে উত্তর নয়** ([04](04-agent-lifecycle.md) §6) |

**Acceptance:** Unknown প্রশ্ন → Admin উত্তর দেয় → ২ মিনিটের মধ্যে Agent সেই প্রশ্নের সঠিক উত্তর দেয়।

### F9 — Basic Dashboard

| ID | Requirement |
|---|---|
| F9.1 | Metrics (গত ৭/৩০ দিন): Total conversations, Total messages, **Answer rate**, Unknown count, Channel breakdown |
| F9.2 | Answer rate প্রকাশ্যে সংজ্ঞায়িত: (মোট AI reply − unknown fallback) ÷ মোট AI reply |
| F9.3 | Usage meter: এ মাসের AI reply count বনাম plan cap (F10) — progress bar |

### F10 — Plan Limits & Billing Lite

**সিদ্ধান্ত:** প্রথম ১০ paying customer-এর জন্য **payment collection manual** (bKash/bank + হাতে invoice)। Automated billing (Stripe/SSLCommerz) Phase 0.5 — কারণ ১০ customer-এ automation-এর ROI নেই, আর ৩+ paying প্রমাণ করাই লক্ষ্য। কিন্তু **limit enforcement software-এ Day 1 থেকে** — নাহলে cost control নেই।

| ID | Requirement |
|---|---|
| F10.1 | Plans (config-driven): Free Trial (১৪ দিন), Starter, Growth — দাম ও cap [10-pricing-unit-economics.md](10-pricing-unit-economics.md) অনুযায়ী |
| F10.2 | Enforce: agent count (১), monthly AI reply cap, storage cap। Cap-এর ৮০%-এ email warning; ১০০%-এ Agent graceful pause ("আমরা শীঘ্রই ফিরছি" + owner notify) |
| F10.3 | Per-org দৈনিক LLM budget kill-switch (cost attack রোধ, [03](03-multi-tenancy-security.md) §6) |
| F10.4 | Admin (আমাদের internal) panel: org-এর plan হাতে set করা যাবে — manual billing-এর হাতিয়ার |
| F10.5 | প্রতিটি LLM call-এর token usage per-org ledger-এ — Day 1 থেকে, কারণ [10](10-pricing-unit-economics.md)-এর unit economics এই data-তেই যাচাই হবে |

---

## 5. Non-Functional Requirements

| বিষয় | Requirement |
|---|---|
| Latency | Chat answer p95 < ৬ সেকেন্ড (end-to-end, LLM-সহ); widget load < ১ সেকেন্ড |
| Uptime | 99.5% (Phase 0 target; পরে 99.9%) |
| Bangla quality | Bangla Eval Suite-এর Phase 0 version (১০০টি বাস্তবধর্মী প্রশ্ন: শুদ্ধ বাংলা / Banglish / mixed) — প্রতি release-এ চালু, score regression হলে block ([08](08-differentiators.md) §2) |
| Security | RLS isolation, encrypted secrets, audit log table, TLS — [03](03-multi-tenancy-security.md)-এর MVP row |
| Cost | প্রতি AI reply-র গড় cost instrumented; [10](10-pricing-unit-economics.md)-এর model-এর সাথে monthly reconcile |
| Browser support | Widget: সর্বশেষ ২ version Chrome/Safari/Firefox/Edge + Android WebView (BD-র FB in-app browser!) |

---

## 6. Instrumentation (Day 1 থেকে measurable)

Funnel event গুলো analytics-এ যাবে: `signup_completed` → `agent_created` → `first_source_uploaded` → `training_completed` → `first_playground_message` → `channel_connected` → `first_live_conversation` → `plan_converted`।

এই funnel-ই বলে দেবে activation কোথায় আটকাচ্ছে — Phase 0-র product সিদ্ধান্ত অনুমানে নয়, এই data-তে হবে।

---

## 7. Decisions — ✅ Resolved (Plan Lock v1.0, 2026-06-12)

1. **Free trial:** ১৪ দিন / ২০০ AI reply — **গৃহীত**।
2. **"Powered by" branding:** Free ও Starter-এ থাকবে (viral loop), Growth+-এ removable — **গৃহীত**।
3. **Meta app review fallback:** review বিলম্বিত হলে pilot customer-রা dev app-এ tester হিসেবে — **গৃহীত**।

Lock-এর শর্তাবলি ও পরিবর্তনের নিয়ম: [13-architecture-review.md](13-architecture-review.md) §Plan Lock।
