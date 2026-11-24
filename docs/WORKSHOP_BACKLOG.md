# Adventure Workshop — backlog (2026-11-23)

Open work not yet turned into Codex jobs. When an item becomes a job, move it to `docs/CODEX_JOBS.md` and delete it here.

## From the user

### Screens and play
- **Challenge stays selected:** after trying a challenge (test run or failure), the same challenge is selected again on return.
- **Challenge view shows the vehicle, not a word list:** show the complete vehicle (or dino) below the challenge list. The player moves
  the cursor (touch / controller) over its parts, and the hovered part's name pops up. Remove the long list of part words (too
  much reading for kids).
- **Back buttons:** there are none yet (Esc / B only). Every screen needs a visible back control, especially on touch.
- **Scoreboard / trophy screen** for past successes (later feature; successes are already kept in the save).

### Art, review round 3 (`feedback/workshop-art-feedback_3.json`)
- **Race springs:** Soft (and Sport) springs sit too low; move them up into the body so their tops don't show between the tires and
  the body.
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
