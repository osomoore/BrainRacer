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
- When a device creates a family, the server generates an internal random 128-bit `familyId` and returns `serverTime`
  and a code such as `RAPTOR-TURBO-FOSSIL-WHEEL`. A code contains exactly four words and no digits. Cryptographic
  randomness selects each word from the same shared list of 512 short, kid-safe dino and car words, for 36 bits of
  entropy. The list covers dinosaur names and body parts, fossils, eggs, volcanoes, car parts, racing, and roads.
  Input accepts either case and spaces or dashes between words. All four words must match the list exactly. The two
  apps and the server normalize the input to uppercase with a single dash between words.
- In each fixed hourly window, the first 10 failed code attempts per IP return 401. Further authentication attempts
  from that IP return 429 until the window resets. Successful authentication releases its reserved failure slot.
- The code is the bearer secret ("house key"). The server stores only a SHA-256 hash of the normalized code for its
  `familyId` lookup.
- Joining a device: type the code or scan a QR (QR encodes `<site>/?join=<code>` so a phone camera opens the game
  and joins). The TV shows the QR; tablets/phones scan it; TVs type the code with the on-screen keyboard.
- Leave family (device only) and Delete family (wipes server data) live in the admin menu.

## API (JSON over HTTPS, CORS for the GitHub Pages origin and localhost dev ports)
All family routes take header `Authorization: Family <code>`.
- `POST /v1/family` → `201 { code }` (creates family). Rate limit per IP.
- `GET /v1/family` → `200 { profiles: [{ id, rev, updatedAt, deleted?, data }] }` (full snapshot; data is opaque JSON).
- `GET /v1/family?since=<serverTime>` → only profiles changed after that time, plus `serverTime`.
- `PUT /v1/family/profile/:id` body `{ baseRev, data, deleted? }` →
  `200 { rev, updatedAt }` when `baseRev` equals the stored rev (or the profile is new and `baseRev` is 0).
  A stale PUT returns `409 { current: { id, rev, updatedAt, deleted, data } }` for the client to merge and retry.
  The `deleted` flag is true for a tombstone and false for a live record. If no record exists yet, the revision and
  timestamp are 0, with `deleted: false` and `data: null`. A profile DELETE tombstone has `data: null`. A tombstone
  written by PUT can retain its opaque `data`.
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

## Merge duplicate profiles after joining

Before Family sync, two devices could create separate profiles with the same name. Joining keeps both profiles so each device’s progress is preserved. When both entries belong to the same child:

1. Use **Family sync → Sync now** on each device so recent saves reach the family before you merge.
2. Open **Profiles** in Adventure Workshop’s grown-up settings or Brain Racer’s **Admin Settings**. Compare creation dates and the progress summaries from both games.
3. Choose **Merge** on the same-name hint to keep the oldest matching profile, or choose **Merge into…** on the profile you want to retire and pick the one to keep. Confirm the source and destination. For three or more copies, repeat for the remaining copies.
4. Use **Sync now** on the device where you merged, then on the other devices. The combined save uploads before the old profile is removed. If an additional save for the retired profile reaches sync, it can reappear with that progress. Sync both devices and merge the remaining copy again.

The chosen profile keeps its name and creation date. Parts, challenge clears and their history, buddies, worlds, and collectibles from both saves are combined. JBQ counts keep the higher count for each question. Settings, wallets and current builds use the newer saved values from the existing sync rules. Older unsynced saves with no recorded edit time use their creation date. A local storage error during a merge leaves both profiles available. When a merge changes a profile selected by two Workshop panes, one pane keeps the combined profile and the other returns to the profile picker.

**Delete** also acts across both games and asks for confirmation twice. Use **Merge** when both profiles contain progress you want to keep.

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

## Local storage inventory and sync mapping

| Exact key | Store | Owner / contents | Sync classification | Snapshot mapping |
| --- | --- | --- | --- | --- |
| `hub.profiles` | localStorage | Shared profile identities and names | Per-profile | `profile` |
| `hub.profileSeq` | localStorage | Monotonic legacy `p<n>` allocator | Device-local metadata | Advanced when importing or hiding `p<n>` identities |
| `hub.legacyIds` | localStorage | Old Brain Racer racer ID → shared profile ID migration map | Device-local migration metadata | Never uploaded |
| `hub.profileEditTimes.v1` | localStorage | Last local edit by profile when selecting merge scalars | Device-local metadata | Uses sync edit times when linked |
| `hub.profileReplacements.v1` | localStorage | Retired profile ID → replacement ID or deletion, used by screens with a cached selection | Device-local metadata | Merge tombstones carry the replacement ID |
| `hub.lastGame` | localStorage | Last launcher game | Device-only preference | Never uploaded |
| `hub.familySync.v1` | localStorage | Family code and per-profile revision/dirty/hash/device sync state | Device-local sync metadata | Never uploaded |
| `hub.familySyncFake.v1` | localStorage | Credentials and revisions for fake sync | Development-only sync metadata | Kept separate from real family credentials |
| `hub.familySyncFakeServer.v1` | sessionStorage | Fake backend family data | Development-only session data | Never uploaded |
| `brainracer.settings.v1` | localStorage | Global race options, per-profile quiz preferences, current player slots | Mixed | `racer.settings` holds quiz preferences. Map, seed, volumes, global timing, challenge mode, developer mode, slot order, and controller choices stay local. |
| `brainracer.loadouts.v1` | localStorage | Keyed per-profile car/buddy/developer loadouts | Per-profile | `racer.loadout` |
| `brainracer.secondPlayer.v1` | localStorage | Compatibility copy of second player settings | Device-local slot compatibility | Extracts `racer.loadout` by profile ID when an older save has no keyed loadout |
| `brainracer.racers.v1` | localStorage | Progress map by profile (worlds, collectibles, admin overrides) | Per-profile | `racer.progress` |
| `brainracer.jbq.v1` | localStorage | Correct-answer counts by profile and question | Per-profile | `racer.jbq` |
| `brainracer.unlocks.v1` | localStorage | Deprecated pre-profile earned collectible list, read only during legacy migration | Device-local migration source | Never uploaded after migration |
| `brainracer.content.v1` | localStorage | Deprecated pre-profile world/override state, read only during legacy migration | Device-local migration source | Never uploaded after migration |
| `brainracer.legacyRemap.v1` | localStorage | One-time legacy Racer migration marker | Device-local migration metadata | Never uploaded |
| `brainracer.backup.preProfiles` | localStorage | Recovery backup of pre-migration Brain Racer keys | Device-local recovery data | Never uploaded |
| `brainracer.tuning.v1` | localStorage | Device performance tuning | Device-only | Never uploaded |
| `brainracer.mobileOverride` | sessionStorage | Per-tab mobile test override | Device-only test preference | Never uploaded |
| `workshop.players.v1` | localStorage | `Record<profileId, PlayerSave>` (reading, wallets, models, parts, challenges, buddies, progress) | Per-profile | `workshop` |
| `workshop.device.v1` | localStorage | Workshop admin mode | Device-only | Never uploaded |

An existing `p<n>` ID that collides with a different remote profile is reassigned locally with its existing saves and slot references. New profiles created on a linked device use random IDs. Aggregate maps are updated one profile at a time.

JBQ counts use the maximum for each question. Workshop board generation counters use the maximum, and two different cards with the same generated ID can both be kept in history. A newer snapshot that has never saved in one game or Workshop room keeps the older saved data for that game or room. Ties use the server's scalar values, and a tombstone wins a tie. Applying a tombstone hides the shared profile on this device and retains its underlying game saves.
