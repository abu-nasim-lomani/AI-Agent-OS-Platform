# ops/verify-local.ps1 — Sprint 0 local verification (S0-11 + infra smoke)
# চালানো (reboot-পরবর্তী, repo root থেকে):  pwsh ops/verify-local.ps1
#
# এই অংশ কোনো external API key ছাড়াই চলে: infra up -> migrate -> RLS isolation।
# পূর্ণ golden path (signup->upload->ask->grounded answer) আলাদাভাবে দুটো service +
# VOYAGE_API_KEY + ANTHROPIC_API_KEY লাগে — নিচের §Manual দেখুন।

$ErrorActionPreference = "Stop"
$env:Path += ";C:\Program Files\Docker\Docker\resources\bin"

Write-Host "==> 1/4 Docker engine check"
$ver = docker info --format '{{.ServerVersion}}' 2>$null
if (-not $ver) { throw "Docker engine down. Start Docker Desktop (reboot পরে WSL2 backend চালু হবে)." }
Write-Host "    engine $ver"

Write-Host "==> 2/4 Stack up (postgres, redis x2, minio)"
docker compose up -d
# postgres healthy হওয়া পর্যন্ত অপেক্ষা
for ($i = 0; $i -lt 30; $i++) {
  $h = docker inspect --format '{{.State.Health.Status}}' agentos-postgres-1 2>$null
  if ($h -eq "healthy") { break }
  Start-Sleep 2
}
if ($h -ne "healthy") { throw "postgres not healthy" }
Write-Host "    postgres healthy"

Write-Host "==> 3/4 Migrate (0001 schema+RLS, 0002 auth bootstrap)"
pnpm db:migrate

Write-Host "==> 4/4 RLS isolation test (S0-11) — app role, NOBYPASSRLS"
# app role দিয়ে — superuser নয়; এটাই প্রকৃত prod-পথ
Get-Content db/tests/rls_isolation.sql | `
  docker compose exec -T postgres psql -U agentos_app -d agentos -v ON_ERROR_STOP=1 -f -

Write-Host ""
Write-Host "VERIFY-LOCAL: infra + migrate + RLS isolation PASS" -ForegroundColor Green
Write-Host ""
Write-Host "§Manual — full golden path (keys লাগবে):" -ForegroundColor Yellow
Write-Host "  1. .env-এ VOYAGE_API_KEY + ANTHROPIC_API_KEY বসান"
Write-Host "  2. pnpm dev                                   # api :4000, web :3000"
Write-Host "  3. cd services/ai; uv sync; uv run uvicorn app.main:app --port 8000"
Write-Host "  4. cd services/ai; uv run python -m app.ingestion.worker   # আলাদা terminal"
Write-Host "  5. signup -> agent create -> PDF upload -> ask  (curl/Playground :3000)"
