# OPERATIONS

How to run, schedule, observe, back up and restore the platform. Verified
behaviour is marked; anything not yet built is called out explicitly.

## 1. Processes

| Process | Command | Notes |
|---|---|---|
| Web app | `npm run build` then `npm run start` | Serves the public site and `/admin`. `next start` runs with `NODE_ENV=production`; set `DOTENV_FILE=.env.development` to preview it against dev config |
| Ingestion worker | `npm run worker` | One pass over all active sources, then exits. `--source <id>` limits to one source, `--max-items N` caps items per source, `--json` emits one JSON object per line |
| Dev server | `npm run dev` | Local development only |

Both the app and the worker import the same `lib/` code and the same
`DATABASE_URL`. There is no queue or long-running scheduler inside the app.

## 2. Scheduling the worker

The worker is deliberately a one-shot process, so any scheduler works. Use
`INGESTION_CRON` (default `0 */6 * * *`) as the documented schedule and keep the
scheduler's own expression in sync with it.

- **Linux/macOS (cron)**
  ```cron
  0 */6 * * * cd /srv/aidiscovery && /usr/bin/npm run worker >> /var/log/aidiscovery-worker.log 2>&1
  ```
- **Windows (Task Scheduler)**: create a daily task, trigger "repeat every 6 hours", action `cmd /c "cd /d <repo> && npm run worker >> worker.log 2>&1"`.
- **Docker/Kubernetes**: run the worker image as a `CronJob`/scheduled container with the same env file; give it a shutdown grace period longer than the longest expected run.
- **CI**: a scheduled pipeline job works, but needs network access to the source feeds and the production database.

### Windows Task Scheduler (verified 2026-09-22)

Verified tasks (registered 2026-09-22, dispatch confirmed by Task Scheduler writing real worker logs):

| Task | Wrapper | Schedule |
|---|---|---|
| `AIDiscovery-IngestionTools` | `run-worker-tools.cmd` -> `npm run worker` | daily 02:00, repeat every 6h |
| `AIDiscovery-IngestionModels` | `run-worker-models.cmd` -> `npm run worker:models` | daily 02:00, repeat every 6h |

Notes from live verification:
- Wrappers `cmd /c "<temp>\run-worker-*.cmd"` set the repo as CWD, invoke the npm script and append JSON lines to a per-worker log in the same temp dir. That temp dir is used because it is writable from the scheduled (non-admin) context.
- On-demand dispatch (`schtasks /Run`) executed both tasks: exit result 0, real log lines produced, and `ingestion_runs` rows confirm the runs. The tools worker exits non-zero if any tool source fails; the models worker ends with a `run_summary` even when only model sources were eligible.
- Task registration must allow battery use: the default settings (`DisallowStartIfOnBatteries`) leave the task stuck "Queued" on laptops running on battery. Register with `AllowStartIfOnBatteries` / `DontStopIfGoingOnBatteries` (this host is a laptop).
- The tasks run as the interactive user (`InteractiveToken`); they will not dispatch from a non-interactive/service session. There is no in-app scheduler; Task Scheduler (or `schtasks /Create ... /SC ...`) is the dispatcher, matching `INGESTION_CRON` as the documentation-only default.

The scheduled run also surfaced and fixed a real production bug: the tools worker previously selected *all* active sources (including `model:*` ones), which it cannot resolve, so the whole run failed. `runIngestion` now excludes `model:` sources; the tools worker handles tool sources only, the models worker model sources only.

The ingestion worker has retry/backoff for transient HTTP errors (see `docs/project-memory/INGESTION.md`); a scheduled run will surface any source failure via a non-zero exit and a failed `ingestion_runs` row.

Guardrails already in place:
- The run is idempotent (`tool_sources(source_id, source_item_id)` + dedupe), so an overlapping schedule will not duplicate tools.
- Each source is isolated; one failing source does not abort the others.
- The process exits non-zero when any source ends `failed`, so a scheduler can alert on exit code alone.

## 3. Logging & observability

- **Worker**: every line carries an ISO timestamp and levels (`INFO`/`WARN`/`ERROR`), and a terminal `run_summary` event reports `sources, fetched, created, updated, duplicates, invalid, errors, aiProcessed, aiFailed, durationMs`. With `--json` each line is a single JSON object (`ts`, `level`, `service`, `message`, `meta`) ready for a log collector. A missing `GEMINI_API_KEY` is reported as a warning, never as a silent degradation.
- **Web app**: Next.js server logs plus per-request HTTP status. Errors from route rendering surface in the server log; the smoke script is the quickest way to assert the deployment is healthy.
- **Admin UI** (`/admin/runs`) shows the same metrics per run — fetched/created/updated/duplicate/invalid/error counts, AI processed vs failed, duration, adapter key, start and finish times, and the error message — so operators do not need shell access to see pipeline health.
- **Database**: `ingestion_runs` (per source, with `metrics` jsonb), `ingestion_items` (per item outcome), `ai_processing_logs` (AI attempts), `content_revisions` (every editorial mutation).

Suggested alerting: non-zero worker exit code, any run `failed`, `errors > 0`, `aiFailed` spikes, and no `run_summary` event within 2× the schedule interval.

## 4. Backups

`npm run db:backup` dumps the configured database with `pg_dump` **inside the Postgres container** (no local client needed), copies the archive into `backups/`, refuses to keep an empty file, and prunes all but the newest `BACKUP_RETENTION` (default 7) dumps.

```bash
npm run db:backup
# [backup] wrote .../backups/backup-20260917T004239Z-aidiscovery_dev.dump
# [backup] retention 7, kept 1
```

Configure with `PG_CONTAINER`, `BACKUP_DIR`, `BACKUP_RETENTION`. Files are named
`backup-<UTC timestamp>-<database>.dump` (custom format, `-F c`), which is what
makes pruning deterministic; unrelated files in the directory are never touched.

### Restore (verified procedure)

```bash
docker cp backups/<file>.dump aidiscovery-pg:/tmp/restore.dump
docker exec aidiscovery-pg createdb -U aidiscovery aidiscovery_restore_check
docker exec aidiscovery-pg pg_restore -U aidiscovery -d aidiscovery_restore_check /tmp/restore.dump
docker exec aidiscovery-pg psql -U aidiscovery -d aidiscovery_restore_check -c "\dt"
docker exec aidiscovery-pg dropdb -U aidiscovery aidiscovery_restore_check
```

Restore should be rehearsed into a scratch database (never over the live one).
The backup produced on 2026-09-22 was restored this way: 26 tables and the
seeded/ingested rows came back intact (verified row count parity: tools 5,
models 4, sources 4, ingestion runs 8, categories 4, collections 1).

Schedule backups on the same host (or ship the archive off-host — a dump next to
the database it protects is not a backup). Test restores periodically.

## 5. Pre-launch checklist

1. `npm run typecheck && npm run lint && npm test` — all green against a real Postgres.
2. `npm run build` — zero warnings.
3. `npm run smoke -- --url https://<origin>` — 28/28 checks.
4. Environment: real `NEXT_PUBLIC_SITE_URL`, strong `AUTH_SECRET`, production
   `ADMIN_*` rotated after seeding, `GEMINI_API_KEY` if AI enrichment is wanted,
   `ADSENSE_*`/affiliate settings only if monetization is live.
5. Remove or never run the dev seed against production (it contains labelled
   sample tools and a demo sponsored campaign).
6. Confirm the worker schedule, backup schedule and log destination.
7. Re-read `docs/project-memory/SECURITY.md` "Outstanding before launch".
