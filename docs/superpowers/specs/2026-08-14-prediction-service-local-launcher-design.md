# Prediction-Service Local Launcher Design

**Date:** 2026-08-14  
**Scope:** Eliminate recurring local schedule-generation failures caused by an
unstarted private ML prediction service.

## Context and root cause

Schedule generation is a Laravel queue job that calls the private FastAPI
contract at `http://127.0.0.1:8100/internal/v1/section-demand/predict`. The
Program Chair's browser never calls this service directly. The service currently
has to be launched manually with Uvicorn, so after a machine restart or terminal
crash the TCP port is unavailable and Laravel records `cURL error 7`. The
generation run then correctly reaches its failed state with the generic service
connection message.

The fix must preserve the PRD's independent `frontend/`, `backend/`, and
`ml-service/` runtime boundaries. Laravel must not launch Python from a web or
queue request.

## Approved approach

Add `scripts/start-local.ps1`, an explicit Windows local-development launcher.
It will:

1. Resolve the repository root and the existing
   `ml-service/.venv/Scripts/python.exe` interpreter.
2. Call the private ML health endpoint. If its documented response is already
   healthy, it will reuse that service. Otherwise it will start Uvicorn bound
   only to `127.0.0.1:8100` and poll the health endpoint for a bounded period.
3. Start the Laravel API and Next.js client in separate hidden child processes
   only when their configured local ports are free. A port already held by an
   unknown process is an actionable launcher error rather than an assumed healthy
   service.
4. Print the three local URLs, child process IDs, and a clear failure message
   when a dependency cannot start. It will not stop or replace a process it did
   not launch.

Existing individual commands in the root and ML-service READMEs remain valid;
the launcher is the recommended single entry point for local work that includes
schedule generation.

## Alternatives rejected

- Continue using the documented manual Uvicorn command: this is the direct
  cause of the recurring failure.
- Start Uvicorn inside Laravel when a prediction request fails: this couples a
  request-serving process to Python lifecycle management and is unsafe for the
  independent deployment architecture.
- Install a Windows service or Scheduled Task: appropriate only for a managed
  deployment workstation, but it changes machine-wide state and is outside this
  repository-scoped fix.

## Failure handling

- Missing virtual environment/interpreter: stop before starting other services
  and show the documented ML setup command.
- ML health endpoint remains unavailable after the bounded wait: stop and report
  the prediction-service command and log location; do not start a schedule run.
- API or frontend port occupied by an unknown process: stop with that port and
  owning process ID; do not kill it.
- A healthy existing private ML service: do not create a duplicate process.

The application retains its existing failed-run persistence and UI retry state
for genuine prediction-service outages. This launcher prevents the routine local
outage; it does not hide or automatically retry a failed forecasting job.

## Test and verification strategy

Before implementation, add focused PowerShell contract coverage for the
launcher helpers using injectable probe/start functions so no real listener or
long-lived process is needed. Cover these behaviors:

1. A healthy ML endpoint is reused and is not started again.
2. An unavailable ML endpoint starts the expected Uvicorn command and is polled
   until healthy.
3. A missing interpreter and an occupied unknown port fail before dependent
   processes are launched.

After the focused tests, run the script against the local virtual environment,
verify `GET /internal/v1/health`, and run the existing Laravel generation test
and ML-service test suite. Update both READMEs with the launcher command and
manual fallback.

## Non-goals

- Production process supervision, containers, Windows services, or Scheduled
  Tasks.
- Database migrations, model behavior, forecast data, or prediction outputs.
- Browser-to-ML connectivity, credentials, or changes to bearer authentication.
