# Runbooks

[docs/12-observability-monitoring.md](../../docs/12-observability-monitoring.md) §3-এর alert table-এর সঙ্গী। নিয়ম: **runbook-link-হীন alert rule merge হবে না।**

| ID | শিরোনাম | Status |
|---|---|---|
| RB-1 | API error rate spike — rollback/restart | TODO(S0-13) |
| RB-2 | LLM provider + fallback উভয় ব্যর্থ | TODO(S0-13) |
| RB-3 | DB primary failover | TODO(S0-13) |
| RB-4 | Global LLM spend runaway — kill-switch | TODO(S0-13) |
| RB-5 | Ingestion queue stuck / poison job | TODO(S0-13) |
| RB-6 | Meta webhook failure / token expiry | Messenger sprint-এ |

প্রতিটি runbook-এর কাঠামো: লক্ষণ → যাচাই (কোন dashboard/query) → পদক্ষেপ (ধাপে ধাপে কমান্ড) → escalation → postmortem লিংক।
