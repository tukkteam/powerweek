# 0008 · Exercise illustrations come from an open library the assistant links to

Date: 2026-11-13 · Status: Accepted

## Context

Training should be something you glance at between sets, not a checklist: each exercise needs a drawing and its muscles. Generating an image per exercise with a model would be slow, inconsistent and expensive. Drawing 300 exercises ourselves is a project of its own.

We compared the open options: Everkinetic (about 100 drawings, CC BY-SA), wger (large, mixed photos and drawings under various licenses), free-exercise-db (photos), icon sets (too generic) and Workout Guide by Bryl Lim: 302 exercises, three frames each, one consistent line style built on Everkinetic, MIT code and CC BY-SA 4.0 artwork, with a manifest of names, equipment and muscles.

## Decision

- Import Workout Guide at a pinned commit with `pnpm moves` ([scripts/moves.mjs](../../scripts/moves.mjs)): SVGO shrinks the 906 frames from 24.7 MB to 5.9 MB, they are served from `apps/web/public/moves/<slug>/<frame>.svg`, and the catalogue becomes `packages/core/src/moves-data.ts`.
- Render frames as CSS masks so they take the brand colour in both themes; animate the three frames only on hover, focus or in the exercise sheet.
- Store an optional `move` slug on each exercise. The assistant chooses it from the catalogue in its prompt; a deterministic name matcher covers older plans, manual edits and model omissions.
- Draw muscles with low-poly body outlines from react-body-highlighter (MIT), lit by training volume.
- Keep attribution in [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md), `apps/web/public/moves/README.md`, the exercise sheet and Settings.

## Consequences

- No per-request image cost: the model emits a slug, the browser loads a cached 5–20 KB SVG.
- The artwork keeps its CC BY-SA 4.0 license (adaptations included); the rest of the code stays MIT.
- Frames from the upstream library are not always drawn at the same scale, so animations can "breathe"; a future brand redraw can keep the same slugs and file layout.
- Adding a move means updating the upstream commit (or adding our own frames) and re-running `pnpm moves`; slugs in stored plans must stay stable.
