# 本地冒烟：login → getConfig → syncCaseResult → getProfile → leaderboard → claimHabitat
$ErrorActionPreference = "Stop"
$base = if ($env:PET_API_BASE) { $env:PET_API_BASE.TrimEnd("/") } else { "http://127.0.0.1:3000" }

function Post($path, $body, $token) {
  $headers = @{ "Content-Type" = "application/json" }
  if ($token) { $headers["Authorization"] = "Bearer $token" }
  $json = $body | ConvertTo-Json -Depth 8 -Compress
  return Invoke-RestMethod -Method Post -Uri "$base$path" -Headers $headers -Body $json
}

Write-Host "health..."
$h = Invoke-RestMethod -Uri "$base/health"
if ($h.status -ne "ok") { throw "health failed: $($h.status)" }

Write-Host "login..."
$login = Post "/api/login" @{ code = "smoke-dev-code"; version = "0.1.0"; channel = "dev" } $null
if ($login.code -ne 0) { throw "login failed: $($login | ConvertTo-Json -Compress)" }
$token = $login.data.token

Write-Host "getConfig..."
$cfg = Post "/api/getConfig" @{ version = 0 } $token
if ($cfg.code -ne 0) { throw "getConfig failed" }
if (-not $cfg.data.configs.cases) { throw "cases config missing" }

Write-Host "syncCaseResult..."
$sync = Post "/api/syncCaseResult" @{
  caseSessionId = "smoke-session-1"
  caseId = "case_cat_001"
  diagnosis = @{ type = "auscultation"; stars = 3; mistakes = 0; durationMs = 1000 }
  treatment = @{ result = "success"; medicineUsed = @("健胃药"); bedUsed = $false; healing = 3 }
  durationMs = 5000
  adopted = $true
} $token
if ($sync.code -ne 0) { throw "sync failed: $($sync | ConvertTo-Json -Compress)" }

Write-Host "getProfile..."
$profile = Post "/api/getProfile" @{} $token
if ($profile.code -ne 0) { throw "profile failed" }
if ($profile.data.collection.adoptedCount -lt 1) { throw "adopted pet missing" }

Write-Host "leaderboard..."
$board = Post "/api/leaderboard" @{ type = "reputation"; page = 1; pageSize = 20 } $token
if ($board.code -ne 0) { throw "leaderboard failed" }

Write-Host "claimHabitat..."
$claim = Post "/api/claimHabitat" @{ lastClaimTime = [int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - 8*3600*1000) } $token
if ($claim.code -ne 0 -and $claim.code -ne 1003) { throw "claimHabitat failed: $($claim | ConvertTo-Json -Compress)" }

Write-Host "SMOKE OK"
