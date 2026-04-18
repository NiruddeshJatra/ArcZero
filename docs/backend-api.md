# ArcZero — Backend API (v2 Scaffold)

> Status: **NOT IMPLEMENTED** — local leaderboards only in Phase 3.
> This document describes the REST endpoints planned for v2 server-side features.

---

## Auth

All write endpoints require a bearer token or signed anonymous-ID header.

```
X-ArcZero-AnonId: az_<16 hex chars>
```

No login required for reads.

---

## Endpoints

### `POST /api/scores`

Submit a run score.

**Body:**
```json
{
  "anonId": "az_...",
  "name": "player",
  "score": 847,
  "level": 5,
  "chainBest": 11,
  "closestMissM": 2.3,
  "durationS": 183,
  "seed": "arczero_2026-04-17",
  "dateISO": "2026-04-17",
  "inputType": "kbd",
  "modifiers": [],
  "physicsVersion": 1
}
```

**Response:** `201 Created` with the leaderboard rank.

---

### `GET /api/leaderboards/daily/:dateISO`

Returns top-20 entries for the given daily seed.

**Response:**
```json
{
  "dateISO": "2026-04-17",
  "seed": 123456789,
  "entries": [
    { "rank": 1, "name": "player", "score": 1200, "chainBest": 14 }
  ]
}
```

---

### `GET /api/leaderboards/alltime`

Returns top-20 campaign (unseeded) scores.

---

### `GET /api/leaderboards/weekly`

Returns top-20 scores aggregated across the last 7 daily seeds.

---

### `POST /api/milestones`

Sync milestone state from client. Server deduplicates.

**Body:**
```json
{
  "anonId": "az_...",
  "milestones": { "first_intercept": true, "chain_5": true }
}
```

---

## Notes

- `physicsVersion` must match the server-side constant; mismatched submissions are rejected (prevents exploits from modified physics).
- Daily seeds are derived server-side via `seedFromDateISO` — clients cannot forge them.
- Rate limit: 10 submissions/hour per anonId.
- All data is anonymous by default; `name` is a display alias set by the player (max 16 chars, no PII).
