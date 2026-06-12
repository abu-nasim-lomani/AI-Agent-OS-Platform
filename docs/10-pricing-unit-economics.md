# 10 — Pricing & Unit Economics

## সারসংক্ষেপ (বাংলায়)

এই ডকুমেন্ট জবাব দেয় ব্যবসার সবচেয়ে বিপজ্জনক প্রশ্নের: **প্রতিটি customer-এ আমরা টাকা কামাই, না হারাই?** মূল ফলাফল: economy-tier model + prompt caching + hard cap দিয়ে একটি AI reply-র খরচ **$0.0025–0.004** রাখা যায়; ফলে Starter plan (৳1,990/মাস, ১,০০০ reply cap)-এও gross margin **~৭০%** থাকে। শর্ত তিনটি: (১) plan-গেটেড model tiering — সস্তা model default, (২) reply cap কঠোরভাবে enforce, (৩) প্রতিটি LLM call-এর cost per-org ledger-এ মাপা ([09](09-product-requirements.md) F10.5)। এগুলো ছাড়া ১,০০০ customer পেলেও কোম্পানি লোকসানে ডুববে।

> **সব সংখ্যা মডেল, গসপেল নয়।** LLM দাম (২০২৬-০৬ অনুযায়ী) ও exchange rate (১ USD ≈ ৳১২০ ধরা) বদলায়। Phase 0-র F10.5 cost ledger দিয়ে প্রতি মাসে এই মডেল বাস্তব data-র সাথে reconcile হবে — এটি এই ডকুমেন্টের standing নিয়ম।

---

## 1. Cost Driver: এক AI Reply-র শারীরস্থান

প্রতিটি উত্তরে এক LLM call। Token গঠন (RAG pipeline-এর design থেকে, [04](04-agent-lifecycle.md)):

```text
Input  ≈ 3,000 tokens
  ├─ System prompt + persona       ~1,000  (স্থির — cacheable)
  ├─ RAG context (top-5 chunks)    ~1,500  (প্রশ্নভেদে বদলায়)
  ├─ History (সাম্প্রতিক turns)      ~400   (multi-turn-এ cacheable)
  └─ User message                   ~100
Output ≈ 250 tokens
```

### Model Tier-প্রতি খরচ (২০২৬-০৬ দাম, Claude family ভিত্তিতে মডেল করা)

| Tier | Model class | Input $/MTok | Output $/MTok | **Cost / reply (uncached)** | **Cost / reply (cached)** |
|---|---|---|---|---|---|
| `economy` (default) | Haiku-class | $1.00 | $5.00 | **$0.0043** | **~$0.0025** |
| `standard` | Sonnet-class | $3.00 | $15.00 | $0.0128 | ~$0.0075 |
| `premium` | Opus-class | $5.00 | $25.00 | $0.0213 | ~$0.0125 |

গণনা: uncached = (3,000 × input + 250 × output) ÷ 1M। Cached ধরা হয়েছে input-এর ~২,০০০ token (system + history prefix) cache-read rate-এ (~০.১× দাম)।

**Caching-এর দুটি engineering শর্ত** (নাহলে discount নীরবে কাজ করবে না):
1. Prompt-এর স্থির অংশ (system + persona + tool defs) **সামনে**, পরিবর্তনশীল অংশ (RAG context, প্রশ্ন) **পরে** — byte-level prefix match।
2. Model-ভেদে minimum cacheable prefix আছে (Haiku-class-এ ~৪,০৯৬ token পর্যন্ত হতে পারে) — স্থির prefix সেই সীমার উপরে design করতে হবে, নইলে cache engage-ই হবে না। AI Service-এর prompt assembly-তে এটি যাচাইযোগ্য metric (`cache_read_tokens > 0`)।

### আনুষঙ্গিক খরচ (ছোট কিন্তু শূন্য নয়)

| Item | খরচ | নোট |
|---|---|---|
| Embedding (ingestion) | ~$0.01 / ১০০-পাতার PDF | One-time per document; hash-diff retraining-এ আরও কম ([04](04-agent-lifecycle.md) §4) |
| Embedding (প্রতি প্রশ্নের query) | ~$0.000002 | Negligible |
| Storage (S3) | ~$0.023/GB/মাস | Negligible per tenant |
| Offline jobs (eval, enrichment) | Batch API-তে **৫০% ছাড়** | Live chat-এ নয়; eval suite ও bulk re-processing-এ ব্যবহার্য |

**Planning figure (রক্ষণশীল):** economy reply = **$0.004**; গড় conversation (৫ reply) = **$0.02**।

---

## 2. Pricing (প্রস্তাবিত)

Pricing philosophy ([01](01-executive-summary.md)): headline সংখ্যা **Agent count** — সহজ, বোঝা সহজ, বিক্রি সহজ। কিন্তু cost চালায় usage — তাই প্রতিটি plan-এ **fair-use AI reply cap** + model tier gate।

### Bangladesh (BDT/মাস; বার্ষিক payment-এ ২ মাস ফ্রি)

| | **Free Trial** | **Starter** | **Growth** | **Business** | **Enterprise** |
|---|---|---|---|---|---|
| দাম | ৳0 (১৪ দিন) | **৳1,990** (~$17) | **৳4,990** (~$42) | **৳12,990** (~$108) | Custom |
| Agents | 1 | 1 | 5 | 20 | Unlimited |
| AI replies/মাস | 200 | 1,000 | 4,000 | 12,000 | Custom |
| Model tier | economy | economy | economy | economy + standard | সব + **BYO key** |
| Knowledge storage | 20 MB | 100 MB | 500 MB | 2 GB | Custom |
| Channels | Widget | Widget + Messenger | + WhatsApp (Phase 1+) | সব | সব + SLA |
| "Powered by" branding | আছে | আছে | Removable | নেই | নেই |
| Overage | — (pause) | ৳600 / অতিরিক্ত ১,০০০ reply | ৳600/১k | ৳500/১k | Contract |

### Global (USD/মাস — Phase 3 launch; এখনই ডিজাইনে রাখা)

Starter **$19** / Growth **$49** / Business **$129** — তুলনা: Chatbase $40+, Intercom Fin per-resolution-এ এর বহুগুণ। আমরা সস্তা + বেশি capability।

**Overage দাম কেন ৳600/১,০০০:** ১,০০০ economy reply-র cost ≈ $4 ≈ ৳480 — overage সবসময় cost-এর উপরে থাকতে হবে। (Cap ছোঁয়ার UX: [09](09-product-requirements.md) F10.2।)

**Model tier gate-টি margin-এর প্রধান রক্ষাকবচ:** Starter user-কে premium model দিলে reply cost ৫×, margin ধ্বংস। Customer model নয়, tier কেনে ([05](05-tech-stack.md) §3) — ভেতরে কোন model তা আমরা benchmark অনুযায়ী ঠিক করি।

---

## 3. Plan-প্রতি Unit Economics

ধরা হয়েছে: customer তার cap-এর গড়ে **৬০%** ব্যবহার করে (industry-সাধারণ); cost রক্ষণশীল uncached rate-এ; "Infra share" = per-tenant compute/DB/monitoring বরাদ্দ।

| Plan | Revenue/মাস | AI cost (৬০% usage) | AI cost (১০০% usage, worst) | Infra share | **Gross margin (গড়/worst)** |
|---|---|---|---|---|---|
| Starter ($17) | $17 | $2.4 | $4.0 | ~$1.5 | **৭৭% / ৬৮%** |
| Growth ($42) | $42 | $9.6 | $16.0 | ~$2.5 | **৭১% / ৫৬%** |
| Business ($108) | $108 | $28.8 (mixed tier) | $55 (সবটা standard হলে) | ~$4 | **৭০% / ৪৫%** |
| Free Trial | $0 | সর্বোচ্চ $0.8/trial | — | — | CAC-এর অংশ — সস্তা |

পর্যবেক্ষণ:

- **সব plan গড় ব্যবহারে SaaS-সুলভ (৭০%+) margin-এ।** Worst case-ও কোথাও লোকসান নেই — কারণ cap আছে। Cap-হীন "unlimited" দিলে এই table অর্থহীন হয়ে যেত।
- Business plan-এর worst case (৪৫%) আসে standard-tier ব্যবহার থেকে — গ্রহণযোগ্য, কারণ Business customer retention/expansion value বেশি; প্রয়োজনে standard tier-এ আলাদা sub-cap।
- Caching ধরলে প্রতিটি সংখ্যা আরও ~৩০–৪০% ভালো — উপরের table caching ছাড়াই টেকে, caching হলো safety margin।

### Reviewer-এর দুঃস্বপ্ন-দৃশ্য যাচাই

> "Revenue $10, Cost $15 — Product সফল, Company ব্যর্থ।"

এই মডেলে তা ঘটতে পারে কেবল তিনভাবে — তিনটিরই রক্ষাকবচ designed:

| পথ | রক্ষাকবচ |
|---|---|
| Cap enforce না হওয়া | F10.2 hard cap + graceful pause; F10.3 daily budget kill-switch |
| ভুল model tier-এ leak | Model profile plan-গেটেড, LLM Gateway-তে কেন্দ্রীয়ভাবে enforce ([05](05-tech-stack.md) §3) |
| Token bloat (context ফুলে যাওয়া) | Top-k সীমা, history window সীমা, per-reply token budget alert; F10.5 ledger-এ p95 tokens/reply tracked |

---

## 4. Fixed Costs & Break-even

### MVP Infrastructure (মাসিক, Phase 0)

| Item | আনুমানিক |
|---|---|
| Compute (Core ×2, AI Service ×2, Workers — Fargate-class) | ~$180 |
| Postgres (managed, primary + replica) | ~$110 |
| Redis (managed) | ~$40 |
| S3 + CDN + egress | ~$25 |
| Monitoring/logging (managed tier) | ~$50 |
| Meta/দেশীয় খরচ (domain, email, ইত্যাদি) | ~$25 |
| **মোট** | **~$430/মাস** |

১,০০০ customer-এও infra আনুমানিক $1.5–2.5k/মাস (architecture-টি এ scale-এ মূলত linear, [02](02-system-architecture.md) §3) — অর্থাৎ infra কখনোই প্রধান খরচ নয়; প্রধান খরচ **টিম** আর **LLM**।

### Break-even (illustrative)

ধরা যাক blended ARPU ≈ $29 (Starter-ভারী mix), gross margin ৭০% → contribution ≈ **$20/customer/মাস**।

| Milestone | দরকারি paying customers |
|---|---|
| Infra cover ($430) | ~25 |
| Infra + ৫-জনের BD টিম (~$6,500/মাস ধরা) | **~350** |
| Series-ready growth proof | Customer সংখ্যা নয় — retention + NRR ([07](07-roadmap.md) Phase 1 criteria) |

অর্থাৎ Phase 0-র "১০ paying" ব্যবসা টিকিয়ে দেয় না — সেটি **product-market প্রমাণ**; টিকে থাকার সংখ্যা ~৩৫০, যা Phase 1–2-এর GTM-এর লক্ষ্য।

---

## 5. LTV / CAC (প্রাথমিক ফ্রেম)

| Metric | অনুমান | মন্তব্য |
|---|---|---|
| Blended ARPU | $29 | Starter-ভারী শুরু |
| Gross margin | 70% | §3 |
| Monthly churn (SME বাস্তবতা) | 5% | Learning Loop sticky হলে কমবে — এটাই [08](08-differentiators.md)-এর moat #2-এর আর্থিক রূপ |
| **LTV** (ARPU × GM ÷ churn) | **~$400** | |
| CAC budget (LTV:CAC ≥ 5 টার্গেট) | **< $80/customer** | BD-তে FB ads + agency referral-এ অর্জনযোগ্য |

Churn ১%-point কমা = LTV ~$80 বাড়া — **Learning Loop-এ engineering বিনিয়োগের সরাসরি আর্থিক যুক্তি।**

---

## 6. Cost Guardrails (সম্পূর্ণ তালিকা — কোনটি কোথায় enforce হয়)

| # | Guardrail | কোথায় | কবে |
|---|---|---|---|
| 1 | Plan-গেটেড model tiering (economy default) | LLM Gateway | Phase 0 |
| 2 | Hard reply cap + graceful pause + overage | Billing module | Phase 0 |
| 3 | Per-org daily LLM budget kill-switch | Gateway + config | Phase 0 |
| 4 | Prompt caching (prefix design + cache-hit metric) | AI Service | Phase 0 |
| 5 | Per-org token/cost ledger + anomaly alert | Observability ([02](02-system-architecture.md) §6) | Phase 0 |
| 6 | Context discipline: top-k ≤ 5, history window ≤ N turns, per-reply token budget | RAG Engine | Phase 0 |
| 7 | Widget abuse rate-limit + CAPTCHA | Edge | Phase 0 |
| 8 | Batch API (৫০% ছাড়) সব offline job-এ | Ingestion/Eval | Phase 0.5 |
| 9 | Semantic answer cache (একই প্রশ্নের cached উত্তর) | AI Service | Phase 1 |
| 10 | BYO-key (LLM cost customer-এর) | Enterprise tier | Phase 2 |
| 11 | কোয়ার্টারলি model re-benchmark (সস্তা/ভালো model এলে tier remap) | Eval Suite | চলমান |

---

## 7. Sensitivity & ঝুঁকি

| ঘটনা | প্রভাব | প্রতিক্রিয়া |
|---|---|---|
| LLM দাম কমে (ঐতিহাসিক প্রবণতা) | Margin বাড়ে | দাম ধরে রেখে margin নেওয়া, না কি দাম কমিয়ে share নেওয়া — তখনকার GTM সিদ্ধান্ত |
| BDT অবমূল্যায়ন (LLM bill USD-তে, revenue BDT-তে) | Margin ক্ষয় | বার্ষিক pricing review ধারা ToS-এ; Enterprise contract USD-indexed |
| Voice feature (Phase 2) — STT/TTS খরচ আলাদা মাত্রা | নতুন cost line | Voice আলাদা metered add-on হবে, base plan-এ নয় (এখনই সিদ্ধান্ত) |
| গড় conversation দীর্ঘ হওয়া (reply/conv ↑) | Reply-based cap থাকায় revenue-ও বাড়ে | Cap unit "reply" রাখা হয়েছে "conversation" নয় — ইচ্ছাকৃত |
| Heavy-tail tenant (১% customer ৫০% usage) | Cap + overage এদেরই monetize করে | F10.5 ledger-এ চিহ্নিত করে upsell |

---

## 8. সিদ্ধান্তের সারণি — ✅ Approved (Plan Lock v1.0, 2026-06-12)

1. **দাম অনুমোদিত:** §2-এর BDT সংখ্যাগুলো — pilot ১০ customer-এ এই দামেই বিক্রির চেষ্টা হবে (discount নয়; বড়জোর বার্ষিক ছাড়)।
2. **Cap অনুমোদিত:** Starter ১,০০০ / Growth ৪,০০০ / Business ১২,০০০ reply।
3. **Standing rule গৃহীত:** প্রতি মাসে F10.5 ledger বনাম এই ডকুমেন্ট reconcile; গড় cost/reply $0.004-এর ২৫% উপরে গেলে guardrail review বাধ্যতামূলক।

Lock-এর শর্তাবলি: [13-architecture-review.md](13-architecture-review.md) §Plan Lock।
