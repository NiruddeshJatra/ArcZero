# ArcZero Supabase Setup

One-time human setup steps. After completing these, fill in `src/net/config.js` with the project URL and anon key.

---

## 1. Create the Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. **Region:** Singapore (`ap-southeast-1`) — lowest latency to Bangladesh
3. Set a strong database password. Copy it somewhere safe.

---

## 2. Run the Schema

1. In your project dashboard → **SQL Editor** → New query
2. Paste the contents of `supabase/schema.sql` and click **Run**
3. Verify in **Table Editor** that the `scores` table and two views (`leaderboard_daily`, `leaderboard_alltime`) exist

---

## 3. Set the HMAC Secret

1. Dashboard → **Project Settings** → **Edge Functions** → **Secrets**
2. Add a secret named `RUN_TOKEN_SECRET` with a cryptographically random value (e.g., `openssl rand -base64 32`)

The `submit_score` function also needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, but Supabase injects these automatically from the project's built-in env — no manual step needed.

---

## 4. Deploy the Edge Functions

Using the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF

supabase functions deploy start_run
supabase functions deploy submit_score
```

Or upload via Dashboard → **Edge Functions** → Deploy a new function.

**Project ref** is the alphanumeric ID in your project URL: `https://app.supabase.com/project/YOUR_PROJECT_REF`

---

## 5. Fill in `src/net/config.js`

1. Dashboard → **Project Settings** → **API**
2. Copy **Project URL** → `SUPABASE_URL`
3. Copy **anon / public** key → `SUPABASE_ANON_KEY`

```js
// src/net/config.js
export const SUPABASE_URL = 'https://abcdefghijkl.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGci...';
```

The anon key is intentionally in client code — it is public by design. The service_role key stays in Supabase secrets only.

---

## 6. Smoke-test

Open the game, play to game-over, and open the browser DevTools Network tab. You should see:

- `POST /functions/v1/start_run` → `200 { token: "..." }`
- `POST /functions/v1/submit_score` → `200 { accepted: true, rank_daily: N, rank_alltime: M }`

The Leaderboards → TODAY tab should show your score.

---

## 7. Tuning Plausibility Constants

The limits live in two places (keep in sync):

| File | Purpose |
|------|---------|
| `src/net/plausibility.js` | Client-side mirror (tested by `tests/plausibility.test.js`) |
| `supabase/functions/submit_score/index.ts` | Server-side enforcement (top of file, `const` block) |

Defaults (generous to avoid rejecting legitimate runs):

| Constant | Default | When to adjust |
|----------|---------|----------------|
| `ABSOLUTE_CEILING` | 1,000,000 | If real max scores plateau far below this |
| `MIN_DURATION_MS` | 5,000 (5s) | Lower only if very short runs are legit |
| `MAX_SCORE_PER_SEC` | 500 | Tune down once real data shows the realistic cap |
| `MAX_RUN_DURATION_MS` | 1,800,000 (30m) | Increase if L10 runs exceed 30 minutes |

After changing `submit_score/index.ts`, redeploy:
```bash
supabase functions deploy submit_score
```

---

## Architecture Notes

- **Insert path:** client → `start_run` (gets HMAC token) → play → `submit_score` (verifies token, checks plausibility, inserts via service_role). Direct anon inserts are blocked by RLS.
- **Read path:** client → Supabase JS SDK → `leaderboard_daily` / `leaderboard_alltime` views (anon SELECT allowed). Raw `scores` table is not directly accessible to anon.
- **Daily boundary:** UTC+6 (Bangladesh Standard Time). The `day_key` column is denormalized for cheap `WHERE day_key = ?` queries.
- **v2 TODO:** replay-level score signing, `physicsVersion` enforcement, motivated-cheater defenses.
