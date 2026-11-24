# Adventure Workshop — backlog (2026-11-23)

Open work not yet turned into Codex jobs. When an item becomes a job, move it to `docs/CODEX_JOBS.md` and delete it here.

## From the user

### Screens and play
- **In progress (2026-11-24):** buy popup + result buttons (pkg/ws-shopflow), springs higher (pkg/ws-springs), challenge view
  vehicle part walk + challenge stays selected (codex/c26).
- **2-player challenge board:** selecting a challenge shows its text right away in the same pane (no separate detail screen). Queued after C26.
- **Phone join/profile:** the "PLAYER 1" label on the profile chooser is small on a phone (844x390).
- **Back buttons:** there are none yet (Esc / B only). Every screen needs a visible back control, especially on touch.
- **Admin button and screen:** a visible admin button that opens one screen for the admin things. Today admin is only reachable by
  hotkey (F9, LT+RT+Start, mobile gear with a multiplication gate) and the existing panel holds reading level, per-variant
  Auto/Open/Locked, Regenerate challenges, Admin Mode and reset. The user will say what else belongs there. Claude proposes adding
  "Reset this player (fresh start)" and "+10 currency" (already in the C23 job), a profile list, and a reset for the whole device.
- **Scoreboard / trophy screen** for past successes (later feature; successes are already kept in the save).

### Art, review round 3 (`feedback/workshop-art-feedback_3.json`)
- **Dino jaw (all teeth + Rex head):** the jawline runs past the teeth into the neck; it should stop where the jaws meet.
- **Beak:** the lower beak's back edge fades out too early; blend it into the bottom of the head.
- **Claws (all):** still read as a stack in front of the foot in side view. Needs a new depiction (user: "live with it for now, but
  quite bad").
- **Tiny Arms:** the far-side arm is bigger than the near one in side view; make both the same size.
- **Glow:** spots also on the stomach, in faded/different colors.
- **Leaf camo:** much thicker leaves, also on the stomach in a different color (still not fixed).
- **Stripes top view, body:** must be symmetrical (cross fully or stop on both sides). C20 fixed the head only.

## From Claude (noticed while working; user to confirm priority)
- **Push to `dev`:** C20–C24, the join/profile fixes and the reviewer fixes are on `feature/workshop` only. Suggest pushing after C23 merges.
- **Paint:**
  - 6 head sets wait for candidates (side glow, side spotted, overhead stripes, overhead horned, camo + stripes both views).
  - Jeep paints are stale after C12/C19.
  - C18/C20 changed many dino shapes, so check which installed paints now hide the new shape.
  - Every paint run needs the user's yes.
- **Currency follow-up checks:**
  - Which hand-picked starters C22 kept.
  - How admin per-variant overrides mix with bought parts.
  - Whether the tier table keeps payouts small and even in real play.
- **Join screen choices to confirm:**
  - Player 2 joins with A / Space / Enter only (not any key), so a stray arrow can't add a player.
  - The 2-player profile chooser was not screenshot-checked.
- **Hand testing still open:** real controllers, phone, TV box performance (2P room is the heaviest screen), projector readability,
  audio including the new buy/payout sounds.
- **Older ideas from the handoff:** paint strength (bodies look flat), texture resolution for the TV box, painted backdrops switch-on,
  racing-stripe paints.
- **Tooling:**
  - The art reviewer and Vite in `.worktrees` don't pick up file changes, so restart them after merges.
  - The empty folder `.worktrees\ws-baseline` is left over (locked); delete it.
  - Finished Codex worktrees `codex-c1` … `codex-c24` can be removed when the user says so.

## Buddy system (user spec 2026-11-24; jobs C29–C31)
- Buddies use Brain Racer's existing buddy collection, graphics and animations (C29 moves them into `shared/`).
- Each player starts with one buddy (Brain Racer's default). Workshop buddy collection and progress are SEPARATE from Brain Racer's.
- Buddies follow the player around the workshop and playfully interact with stations and activities (e.g. inspecting parts being changed).
- During challenges they react to events: running ahead, pushing a struggling model, helping search, celebrating or reacting to failures. Purely visual; never affects outcomes.
- A buddy progress bar on the side of the main workshop screen fills 0→10, +1 per completed challenge; a question mark at the end is the next unlockable buddy. Filling it unlocks a new buddy (seeded random from the still-locked ones) and resets the bar.
- A dedicated workshop station lets players pick from their unlocked buddies.
- Jobs: C29 shared buddy art move · C30 save/progress bar/unlock/buddy station · C31 behaviors in room and runs.
