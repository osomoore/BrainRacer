# BrainRacer Family Sync Worker

This directory contains the Cloudflare Worker API and its D1 database migrations. The family code is the shared **house key**. Anyone with the code can read, change or delete that family's synced game data. Keep it private and show it only in the parent/admin area.

## Prerequisites

- A Cloudflare account with Workers/D1 access and Node.js 24 installed.
- PowerShell opened at the repository root. The commands use `npm.cmd` and `npx.cmd` so they also work when PowerShell script execution is disabled.

The Worker is configured to use a D1 database named `brainracer-sync`. The first setup creates the database, then saves its generated ID in `server/wrangler.toml`.

## First deployment

From the repository root, log in to Cloudflare and create the database.

```powershell
Set-Location server
npx.cmd wrangler login
npx.cmd wrangler d1 create brainracer-sync
```

Copy the generated `database_id` into the `SYNC_DB` entry in `wrangler.toml`. Apply the migration to the local development database and to the Cloudflare database, then deploy.

```powershell
npm.cmd run migrate:local
npm.cmd run migrate:remote
npm.cmd run deploy
```

Save the Worker URL printed by the deploy command, usually `https://brainracer-sync.<your-subdomain>.workers.dev`. For a local test, run `npm.cmd run dev` from `server/` after applying the local migration and use `http://localhost:8787` as the base URL.

## Smoke checks

Use the deployed HTTPS base URL to create a disposable family and fetch a snapshot. Keep the returned code private.

```powershell
$syncUrl = 'https://brainracer-sync.<your-subdomain>.workers.dev'
$created = Invoke-RestMethod -Method Post -Uri "$syncUrl/v1/family"
$code = $created.code
$headers = @{ Authorization = "Family $code" }
$before = Invoke-RestMethod -Uri "$syncUrl/v1/family" -Headers $headers
$before
```

The initial snapshot should have an empty `profiles` array and a numeric `serverTime` in epoch milliseconds. Write a test profile with `baseRev = 0` and fetch changes since that snapshot.

```powershell
$profileId = 'smoke-test'
$body = @{ baseRev = 0; data = @{ schema = 1; note = 'temporary smoke test' } } | ConvertTo-Json -Depth 10
$saved = Invoke-RestMethod -Method Put -Uri "$syncUrl/v1/family/profile/$profileId" -Headers $headers -ContentType 'application/json' -Body $body
$saved
Invoke-RestMethod -Uri "$syncUrl/v1/family?since=$($before.serverTime)" -Headers $headers
```

The delta should contain the new profile at revision 1. For this disposable family, verify the tombstone and then clean up.

```powershell
Invoke-RestMethod -Method Delete -Uri "$syncUrl/v1/family/profile/$profileId" -Headers $headers
Invoke-RestMethod -Uri "$syncUrl/v1/family?since=$($before.serverTime)" -Headers $headers
Invoke-RestMethod -Method Delete -Uri "$syncUrl/v1/family" -Headers $headers
```

Both DELETE routes return HTTP 200 JSON. Profile DELETE yields `rev`, `updatedAt`, and `serverTime`. The next snapshot contains the tombstone with `deleted: true` and `data: null`. Family DELETE yields `serverTime` and immediately invalidates the code.

## Enable sync in GitHub Pages

In the GitHub repository, open **Settings → Secrets and variables → Actions → Variables** and create the repository variable `VITE_SYNC_URL` with the deployed Worker URL as its value. The **Build game** step reads that variable from the workflow environment. Vite embeds this URL in each build, so rebuild and redeploy when the URL changes.

## Family code changes and deletion

To rotate an exposed code, use a device with the latest saves to create a replacement family through the admin menu. Sync the profiles there, join the other devices with the new code, and verify their saves. Then delete the old family with `DELETE /v1/family` using its old authorization header. Use **Leave family on this device** to clear only the device's association, or **Delete family for all devices** to wipe its records from the live database.

If you created a family with a code ending in digits during testing, pull its latest saves to a device before upgrading the Worker. After upgrading, create a new family from that device and use its four-word code to rejoin the other devices.

## API and limits

- Each family code has four words and no digits. The Worker uses cryptographic randomness to pick each word from a
  shared list of 512 short dino and car words. Input accepts either case and spaces or dashes between words. All four
  words must match the list exactly. The Worker normalizes the code to uppercase with single dashes before hashing it
  with SHA-256 and stores only the hash.
- In each fixed hourly window, the first 10 failed code attempts per IP return 401. Further authentication attempts
  from that IP return 429 until reset. Successful authentication releases its reserved failure slot.
- Authenticated routes take `Authorization: Family <code>`. Use the last successful snapshot's `serverTime` as the next `since` value. The snapshot includes only profiles with `updatedAt` strictly greater than that cursor.
- A family can have up to 20 profile records, including tombstones. Profile `data` can be up to 256 KiB of UTF-8 JSON. The PUT body has a separate size bound to limit JSON parsing work.
- A stale PUT yields HTTP 409 with the current record's ID, revision, timestamp, data, and a `deleted` boolean. It is true for a tombstone and false for a live record or when no record exists yet (revision and timestamp 0, data null). A profile DELETE tombstone has null data. A tombstone written by PUT may retain its opaque data.
- D1 also limits family creation to 10 per IP per hour, authenticated-route attempts to 60 per IP per minute, and requests to 120 per family per minute. All rate-limit responses include `Retry-After` in seconds.
- Families with no activity for 400 days are eligible for manual purge based on `families.last_seen`. Deleting a family also cascades to its profiles. Operators can prune expired counter rows from `rate_limits` using their `expires_at` timestamp in epoch milliseconds.

## Cost, retention, and privacy

D1 has no idle compute charge. Cloudflare Workers Free includes 100,000 Worker requests per day. D1 Free includes 5 million rows read and 100,000 rows written per day, 500 MB per database, and 5 GB total storage. Rate counters and snapshot activity tracking also count toward database usage. Free-plan queries fail after the daily D1 read or write limits are reached. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

D1 Time Travel can restore earlier database states for up to 7 days on Workers Free and 30 days on Workers Paid. A deleted record can therefore remain in the recovery window after it disappears from the live database. [Cloudflare D1 Time Travel and backups](https://developers.cloudflare.com/d1/reference/time-travel/).

The games send profile first names and game progress and settings. The Worker treats that payload as opaque JSON. D1 stores a SHA-256 digest of the family code and hashed IP keys for rate limits. Keep the code out of logs, tickets, and shared terminals.

## Development checks

From the repository root, run `npm.cmd run typecheck`, `npm.cmd --prefix server run typecheck`, and `npm.cmd test`. The Worker tsconfig extends the root config. Route tests run in Vitest with an in-memory store, and the D1 adapter tests use Node's built-in SQLite and the shipped migration.
