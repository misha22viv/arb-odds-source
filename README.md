# arb-odds-source

An independent, read-only odds ingestion service. It is deliberately separate from `arb-scanner`: it collects and stores feed data first; another application can consume its API later.

## Current scope

- Separate service and repository; no dependency on the scanner or BetScoper.
- Fonbet and Winline provider slots, configured independently.
- Generic JSON feed adapter with timeouts, retry/backoff, provider health, normalization and persistent local history.
- Read-only HTTP API for health, providers, events and odds.
- No bookmaker website scraping, authentication automation, CAPTCHA handling, anti-bot bypass or automated betting.

**Important:** no authorized Fonbet or Winline feed URL has been configured or verified yet. The service does not pretend to have live bookmaker odds until a permitted feed is supplied and successfully polled. Public visibility of a website does not automatically grant permission to scrape it.

## Requirements

- Node.js 20.11+
- No paid service required for local operation.

## Run locally

```sh
cp .env.example .env
# Set a feed URL only if you have permission to use it.
node src/server.js
```

The service uses only Node.js built-ins. Persistent data is written to `DATA_DIR` (default: `./data`). Keep this directory on a persistent disk; ephemeral serverless filesystems are not suitable for odds history.

## Feed contract

Each configured URL must return JSON in this shape:

```json
{
  "events": [
    {
      "id": "source-event-123",
      "sport": "football",
      "league": "Example League",
      "home": "Home FC",
      "away": "Away FC",
      "startTime": "2026-12-01T18:00:00Z"
    }
  ],
  "odds": [
    {
      "eventId": "source-event-123",
      "market": "1X2",
      "selection": "home",
      "odds": 2.15,
      "suspended": false
    }
  ]
}
```

Field aliases are accepted by the normalizer; see `src/normalize.js`. Source event IDs are namespaced by bookmaker to prevent cross-provider collisions.

## API

- `GET /health` — service and provider health.
- `GET /api/v1/providers` — provider polling status.
- `GET /api/v1/events` — latest normalized events. Optional `?provider=fonbet`.
- `GET /api/v1/odds` — latest odds. Optional `provider`, `eventId`, `since` (ISO timestamp), `limit` (max 5000).
- `GET /api/v1/history` — recent odds snapshots. Optional `provider`, `eventId`, `limit`.

All endpoints are read-only. Unknown routes return 404.

## Status meanings

- `disabled`: provider is not enabled.
- `not_configured`: enabled but no feed URL supplied.
- `never_polled`: configured, but no poll has completed.
- `ok`: last poll succeeded.
- `error`: last poll failed; previous stored data is retained.
- `stale`: last successful poll is older than three polling intervals.

## Tests

```sh
npm test
```

## Next integration step

After an authorized feed is configured and its data shape is verified, connect the scanner to this service through its read-only API. Keep that integration downstream; this repository must remain independently runnable.
