# Prediction-Service Local Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent recurring local schedule-generation failures by starting and health-checking the private ML prediction service as part of one explicit development launcher.

**Architecture:** A root PowerShell script owns only local process orchestration. It probes the documented private FastAPI health contract, starts Uvicorn only when that contract is unavailable, and refuses to replace unknown processes on occupied API/frontend ports. Its small helper functions accept probe and process-start scriptblocks, allowing Pester to validate lifecycle behavior without real listeners or child processes. Laravel, FastAPI, and browser behavior remain unchanged.

**Tech Stack:** Windows PowerShell 5.1, Pester 3.4, existing Python 3.14 virtual environment/Uvicorn, Laravel 12, Next.js 16.

## Global Constraints

- Keep `frontend/`, `backend/`, and `ml-service/` independently runnable as required by `PRD.md`.
- Bind the prediction service only to `127.0.0.1:8100`; browser clients must never call it.
- Do not make Laravel or a queue job start Python, retry failed forecast work implicitly, or alter failed-run persistence.
- Reuse a response only when `/internal/v1/health` reports `data.service = grc-prediction-service` and `data.status = ok`.
- Never stop, kill, replace, or assume health for a process the launcher did not create.
- Use the existing `ml-service/.venv/Scripts/python.exe`; do not add dependencies or environment files.
- Use `apply_patch` for file content changes. Do not commit or push without explicit user authorization.
- Preserve user-owned `grades-com-student1.png`, root `node_modules/`, and unrelated working-tree changes.
- The user explicitly authorized implementation on `main` and one GitHub saving point, so stage only this plan's files, commit on `main`, and push directly to `origin/main` without a pull request.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `scripts/start-local.ps1` | Root launcher and testable PowerShell functions for private-service health checks, safe process startup, local-port protection, and concise startup output. |
| `scripts/tests/start-local.tests.ps1` | Pester lifecycle contracts for existing healthy service reuse, cold ML startup/readiness, and occupied-port protection. |
| `README.md` | Recommended one-command local startup, URLs, manual fallback, and launcher behavior. |
| `ml-service/README.md` | ML-specific launcher entry point plus unchanged direct-Uvicorn fallback. |
| `PROGRESS.md` | Root-cause evidence, implementation milestones, and actual verification results. |

### Task 1: Testable local launcher

**Files:**
- Create: `scripts/tests/start-local.tests.ps1`
- Create: `scripts/start-local.ps1`

**Interfaces:**
- Consumes: FastAPI `GET /internal/v1/health` response with `data.service` and `data.status`; existing `ml-service/.venv/Scripts/python.exe`.
- Produces: `Start-PredictionService` returning `PSCustomObject` `{ State = 'reused'|'started'; ProcessId = [int] }`; `Start-LocalStack` returning the same prediction state and launching missing API/frontend processes.

- [ ] **Step 1: Write the failing Pester contracts**

Create `scripts/tests/start-local.tests.ps1`. Dot-source the launcher with `-NoAutoStart` and describe the failure each test detects. Use only the injected probe and process-starter boundaries; do not start Uvicorn in Pester.

```powershell
$scriptPath = Join-Path $PSScriptRoot '..\start-local.ps1'
. $scriptPath -NoAutoStart

Describe 'Start-PredictionService' {
    It 'reuses an already healthy prediction service instead of starting a duplicate' {
        $result = Start-PredictionService -HealthProbe { $true } -ProcessStarter {
            throw 'A healthy service must not be started again.'
        }

        $result.State | Should Be 'reused'
        $result.ProcessId | Should Be 0
    }

    It 'starts Uvicorn and waits until the private health contract becomes healthy' {
        $script:probeCount = 0
        $result = Start-PredictionService -HealthProbe {
            $script:probeCount += 1
            $script:probeCount -ge 2
        } -ProcessStarter {
            [pscustomobject]@{ Id = 2468 }
        } -ReadinessAttempts 2 -ReadinessDelayMilliseconds 0

        $result.State | Should Be 'started'
        $result.ProcessId | Should Be 2468
        $script:probeCount | Should Be 2
    }
}

Describe 'Start-LocalStack' {
    It 'fails before launching any process when an API port belongs to an unknown listener' {
        { Start-LocalStack -PredictionOnly:$false -PortProbe { param([int] $Port) if ($Port -eq 8000) { 9876 } else { 0 } } -ProcessStarter { throw 'must not launch' } } |
            Should Throw 'Port 8000 is already used by process 9876.'
    }
}
```

The production change this protects against is accidentally starting a duplicate ML service, declaring readiness after a failed startup, or starting dependent servers beside an unknown port occupant.

- [ ] **Step 2: Run the new test to verify RED**

Run:

```powershell
Invoke-Pester .\scripts\tests\start-local.tests.ps1 -EnableExit
```

Expected: failure because `scripts/start-local.ps1` does not yet exist and cannot expose the requested functions.

- [ ] **Step 3: Implement the minimal launcher**

Create `scripts/start-local.ps1` with parameters `NoAutoStart`, `PredictionOnly`, `ReadinessAttempts`, and `ReadinessDelayMilliseconds`. Define these functions before the final auto-start guard:

```powershell
function Test-PredictionServiceHealth {
    param([uri] $HealthUri)
    try {
        $response = Invoke-RestMethod -Method Get -Uri $HealthUri -TimeoutSec 2
        return $response.data.service -eq 'grc-prediction-service' -and $response.data.status -eq 'ok'
    } catch {
        return $false
    }
}

function Start-PredictionService {
    param(
        [scriptblock] $HealthProbe = { Test-PredictionServiceHealth -HealthUri 'http://127.0.0.1:8100/internal/v1/health' },
        [scriptblock] $ProcessStarter,
        [int] $ReadinessAttempts = 30,
        [int] $ReadinessDelayMilliseconds = 1000
    )

    if (& $HealthProbe) { return [pscustomobject]@{ State = 'reused'; ProcessId = 0 } }
    $process = & $ProcessStarter
    for ($attempt = 1; $attempt -le $ReadinessAttempts; $attempt += 1) {
        if (& $HealthProbe) { return [pscustomobject]@{ State = 'started'; ProcessId = $process.Id } }
        Start-Sleep -Milliseconds $ReadinessDelayMilliseconds
    }
    throw 'The prediction service did not become healthy. Run ml-service/.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8100 for diagnostics.'
}
```

Use `Start-Process -WindowStyle Hidden -PassThru` only after validating the interpreter path and port ownership. Start Uvicorn from `ml-service`; redirect child output and error to ignored `artifacts/local-dev/` log files. Use `Get-NetTCPConnection -State Listen` to return an owning process ID or `0`, and throw exactly `Port <port> is already used by process <pid>.` before starting API/frontend.

`Start-LocalStack` must check ports `8000` and `3000` before calling
`Start-PredictionService`, so an unknown API/frontend listener prevents **all**
new child processes. Its default process starter must use the resolved paths:

```powershell
function Start-LocalStack {
    param(
        [switch] $PredictionOnly,
        [scriptblock] $PortProbe = { param([int] $Port) (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess) -as [int] },
        [scriptblock] $ProcessStarter
    )

    if (-not $PredictionOnly) {
        foreach ($port in @(8000, 3000)) {
            $owner = & $PortProbe $port
            if ($owner -gt 0) { throw "Port $port is already used by process $owner." }
        }
    }

    $prediction = Start-PredictionService -ProcessStarter {
        Start-Process -FilePath $pythonPath -ArgumentList '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8100' -WorkingDirectory $mlServicePath -WindowStyle Hidden -PassThru -RedirectStandardOutput $predictionOutputLog -RedirectStandardError $predictionErrorLog
    }
    if (-not $PredictionOnly) {
        Start-Process -FilePath 'php.exe' -ArgumentList 'artisan', 'serve', '--host=127.0.0.1', '--port=8000' -WorkingDirectory $backendPath -WindowStyle Hidden -PassThru -RedirectStandardOutput $apiOutputLog -RedirectStandardError $apiErrorLog | Out-Null
        Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'dev', '--', '--hostname', '127.0.0.1' -WorkingDirectory $frontendPath -WindowStyle Hidden -PassThru -RedirectStandardOutput $frontendOutputLog -RedirectStandardError $frontendErrorLog | Out-Null
    }
    return $prediction
}
```

The caller resolves `$pythonPath`, `$mlServicePath`, `$backendPath`,
`$frontendPath`, and the three output/error log paths from `$PSScriptRoot`; it
creates `artifacts/local-dev/` before invoking this function. Skip API/frontend
when `-PredictionOnly` is supplied. End with:

```powershell
if (-not $NoAutoStart) {
    Start-LocalStack -PredictionOnly:$PredictionOnly
}
```

- [ ] **Step 4: Run the focused Pester contract to verify GREEN**

Run:

```powershell
Invoke-Pester .\scripts\tests\start-local.tests.ps1 -EnableExit
```

Expected: all three tests pass and no listener or long-lived child process is created.

- [ ] **Step 5: Perform a static PowerShell syntax check**

Run:

```powershell
$errors = $null; [System.Management.Automation.PSParser]::Tokenize((Get-Content -Raw .\scripts\start-local.ps1), [ref] $errors); if ($errors.Count -gt 0) { $errors | Format-List; exit 1 }
```

Expected: exit code 0 and no parser errors.

### Task 2: Document and smoke-test the local startup path

**Files:**
- Modify: `README.md:47-105`
- Modify: `ml-service/README.md:17-31`
- Modify: `PROGRESS.md`

**Interfaces:**
- Consumes: `scripts/start-local.ps1` and the existing direct-Uvicorn command.
- Produces: a documented, reproducible local run path that reaches the same private FastAPI health contract Laravel uses.

- [ ] **Step 1: Update the local-start documentation**

Add this recommended command before the individual frontend/API/ML commands in `README.md`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1
```

Explain that it reuses a healthy private ML service or starts it on loopback, then starts the API on `http://127.0.0.1:8000` and frontend on `http://127.0.0.1:3000`. State that child logs are under ignored `artifacts/local-dev/`, and that `-PredictionOnly` repairs just the prediction service for an already running API/frontend stack. In `ml-service/README.md`, point to the root launcher as the recommended integrated path while retaining its direct Uvicorn command as the diagnostic/manual fallback.

- [ ] **Step 2: Run the launcher in prediction-only mode**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1 -PredictionOnly
Invoke-RestMethod http://127.0.0.1:8100/internal/v1/health | ConvertTo-Json -Depth 5
```

Expected: the launcher reports `started` or `reused`; the response contains `data.service` equal to `grc-prediction-service` and `data.status` equal to `ok`.

- [ ] **Step 3: Verify the prediction client and service contracts**

Run:

```powershell
Set-Location backend; php artisan test tests/Unit/Services/SectionDemandPredictionClientTest.php tests/Feature/Actions/Analytics/GenerateSectionDemandForecastsTest.php
Set-Location ..\ml-service; .\.venv\Scripts\python.exe -m pytest
```

Expected: both Laravel tests and the ML-service suite pass. The PHP test exercises the aggregate-only client contract; the Python suite proves the running service's prediction contract remains unchanged.

- [ ] **Step 4: Record actual results without committing**

Append the exact commands, observed process/health result, test counts, and any intentionally unrun broader suites to `PROGRESS.md`. Run `git diff --check` and report the scoped changed files. Do not commit or push because the user has not authorized either action.

### Task 3: Record the repository workflow and create the authorized GitHub saving point

**Files:**
- Modify: `AGENTS.md:11-14`

**Interfaces:**
- Consumes: the user's explicit instruction to work on `main` and use GitHub as the saving point.
- Produces: a persistent repository instruction that future work occurs on `main` unless the user says otherwise, and that an explicitly requested saving point is a scoped commit pushed to `origin/main`.

- [ ] **Step 1: Update the repository workflow instructions**

Add these two rules immediately after the existing `PROGRESS.md` rule and in
place of the old commit/push rule:

```markdown
- Work directly on the `main` branch unless the user explicitly directs otherwise. When the user requests a saving point, create an intentional scoped commit and push it to GitHub (`origin/main`); do not use local-only worktrees as the saving point.
- Do not commit or push unless the user explicitly requests a GitHub saving point.
```

- [ ] **Step 2: Verify the GitHub publishing prerequisites and scope**

Run:

```powershell
gh --version
gh auth status
git remote -v
git status --short
git diff --check
```

Expected: an authenticated GitHub CLI, an accessible `origin` remote, no
whitespace errors, and a clear separation between the scoped launcher files and
the user-owned screenshot/root `node_modules/` artifacts.

- [ ] **Step 3: Commit and push only the scoped change**

After fresh Task 1–2 verification, stage exactly:

```powershell
git add AGENTS.md README.md ml-service/README.md scripts/start-local.ps1 scripts/tests/start-local.tests.ps1 docs/superpowers/specs/2026-08-14-prediction-service-local-launcher-design.md docs/superpowers/plans/2026-08-14-prediction-service-local-launcher.md PROGRESS.md
git diff --cached --check
git commit -m "fix(dev): start prediction service with local stack"
git push origin main
```

Expected: the pushed `main` commit contains only the documented workflow and
local-launcher fix. Do not stage `grades-com-student1.png`, root
`node_modules/`, or any file outside this explicit list.
