# Workshop art reviewer

Run `npm run art:review` from the repository root. It captures every current Race Shop and Dino Lab catalogue aspect from `WorkshopParts` (each sheet includes side and top views), adds the current dino beak profiles, and opens the grader at `http://localhost:5198/tools/art-review/grade.html` in the normal browser profile. Captures and the generated live catalog are in ignored `shots/`; no screenshots are committed. Vite stays open on port 5198 (override with `--port N` or `ART_REVIEW_PORT`); press Ctrl+C in that terminal when finished.

Ratings and comments save as you edit in this browser under `adventure-workshop.art-review.v1`. Use **Copy all feedback** or **Download JSON** to export an array of `{ workshop, aspect, variant, name, grade, comment }` entries (`grade` is 1–5 or `null`). This export shape and storage key are kept stable for existing reviews.

For a shapes-only capture (useful while reviewing code art before ComfyUI paint), run `npm run art:review -- --shapes`. The default captures the current runtime, including painted assets when available. Captures are regenerated each run and reflect the branch's current variant names and beak profiles.

`node tools/art-review/check-grading.cjs` runs a small Edge check against the open reviewer, covering persistence and JSON export. The page is also usable directly at the URL above after a capture.
