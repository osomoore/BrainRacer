# Family sync (design spec, 2026-11-24)

Goal: a family's kids see the same profiles and progress (Brain Racer + Adventure Workshop) on every device, with
one-time parent setup and nothing for kids to do. Must also work for other families from the same build.

## Decisions (from the user)
- Backend: Cloudflare Worker + D1 (SQLite). No accounts, no emails, no passwords.
- Sync everything per profile: the shared profile (`shared/profiles.ts`), all Brain Racer per-profile data, all
  Adventure Workshop data (`workshop.players.v1`). Device-only things (audio mode, performance/TV settings, debug,
  admin-only device prefs, which pane/controller) stay local. Inventory every localStorage key and classify it.
- A profile is never played on two devices at the same time. Devices may be offline for a while (C44 offline play).

## Family code
- A family is created on one device: server returns `familyId` (random, 128-bit) and a human code of 4 words, no digits,
  all themed on dinosaurs and cars, e.g. `RAPTOR-TURBO-FOSSIL-WHEEL` (user's choice, 2026-11-24). Word list: ~512 short,
  kid-safe, easy-to-spell dino and car words (dino names, dino body parts, fossils/eggs/volcano; car parts, racing,
  road words) → ~36 bits, with strict rate limiting on wrong codes (e.g. 10 failures per IP per hour).
  Typing ignores case and accepts spaces or dashes between words; the words themselves must match exactly.
- The code is the bearer secret ("house key"). Server stores only a SHA-256 of the code → familyId lookup.
- Joining a device: type the code or scan a QR (QR encodes `<site>/?join=<code>` so a phone camera opens the game
  and joins). The TV shows the QR; tablets/phones scan it; TVs type the code with the on-screen keyboard.
- Leave family (device only) and Delete family (wipes server data) live in the admin menu.

## API (JSON over HTTPS, CORS for the GitHub Pages origin and localhost dev ports)
All family routes take header `Authorization: Family <code>`.
- `POST /v1/family` → `201 { code }` (creates family). Rate limit per IP.
- `GET /v1/family` → `200 { profiles: [{ id, rev, updatedAt, deleted?, data }] }` (full snapshot; data is opaque JSON).
- `GET /v1/family?since=<serverTime>` → only profiles changed after that time, plus `serverTime`.
- `PUT /v1/family/profile/:id` body `{ baseRev, data, deleted? }` →
  `200 { rev, updatedAt }` when `baseRev` equals the stored rev (or the profile is new and baseRev = 0);
  `409 { current: { id, rev, updatedAt, data } }` otherwise (client merges and retries).
- `DELETE /v1/family` → wipes the family. `DELETE /v1/family/profile/:id` → tombstone (deleted: true).
- Limits: data ≤ 256 KB per profile, ≤ 20 profiles per family, request rate limits; 401 on unknown code (constant-time),
  413/429 as appropriate. Every response carries `serverTime`.
- D1 tables: `families(id, code_hash, created_at, last_seen)`, `profiles(family_id, id, rev, updated_at, deleted, data)`.
  Families unused for 400 days may be purged (documented, not automatic yet).

## Profile record (the opaque `data`)
`{ schema: 1, profile: PlayerProfile, racer: {...per-profile Brain Racer data}, workshop: PlayerSave, updatedAt }`
Device-local state is never in it. Version it (`schema`) so later builds can upgrade.

## Client sync (offline-first)
- Local storage stays the source of truth for play; sync never blocks the game or the title screen.
- Each device keeps per profile: `rev` last synced, `dirty` flag, `lastPushedHash`. Stored under a new device key.
- Sync moments: app open (pull), returning online (`online` event), profile chosen (pull that one first), after a save
  that changes progress (debounced push, ~3 s), app hidden/closing (best-effort push with keepalive).
- Push with `baseRev`; on 409 merge local and server and push again (bounded retries).
- Merge rules (pure, Phaser-free, unit-tested). Same-time play doesn't happen, so mostly "newer wins" with safety nets:
  - Growing sets are unioned: bought parts, completed challenges + history, buddies found, Brain Racer unlocks/collectibles,
    achievements/best scores (max).
  - Scalars (wallet, reading level, settings, model/current build, open challenge board, buddy points) come from the
    record with the newer `updatedAt`. If the board/challenges came from the older record, re-deal is allowed
    (CHALLENGE_RULES_VERSION rule: no migrations).
  - Profile name: newer wins. Deletion: tombstone wins over older edits, loses to a newer edit.
- Never wipe local data because the server is unreachable or returns an error. Unknown/garbled server data is ignored
  and reported in the admin sync panel.

## UI (admin menu → "Family sync")
- Not set up: "Make a family" / "Join a family" (type code, or show "scan me" QR on this screen from another device).
- Set up: family code (hidden until "Show"), QR to add another device, sync status (last sync time, pending changes,
  last error), "Sync now", "Leave family on this device", "Delete family for all devices" (double confirm).
- Kids never see codes. A small, calm status dot in the profile screen corner (synced / offline / error) is enough.
- `?join=<code>` on any entry page: confirm with a parent-style prompt in the admin menu, then join and pull.
- Sync is off and hidden when the build has no `VITE_SYNC_URL`.

## Deployment (the user does this once; Codex can't log in to Cloudflare)
- `server/` holds the Worker (own package.json, wrangler.toml with a D1 binding, migrations, tests).
- `server/README.md`: `npx wrangler login`, `npx wrangler d1 create brainracer-sync`, apply migrations, `npx wrangler deploy`,
  then set `VITE_SYNC_URL` for the Pages build (GitHub Actions variable) and rebuild.

## Jobs
- C45 (server): `server/**` only. Worker, D1 schema + migrations, API above, limits, CORS, tests with the Workers Vitest
  pool or Miniflare, README. No client code.
- C46 (client): `shared/sync/**` (pure merge + protocol client, tested), storage adapters for shared profiles, Brain Racer
  and Workshop, admin "Family sync" panel in both apps, QR (small dependency-free QR encoder or an approved package),
  `?join=`, status dot, docs/STATUS.md section. Tests against a fake in-memory server implementing the API above.
