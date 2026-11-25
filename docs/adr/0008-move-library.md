# 0008 · Exercise illustrations come from an open library the assistant links to

Date: 2026-11-13 · Status: Superseded by [ADR 0013](0013-mannequin.md) on 2026-11-25

> The app now draws every exercise with its own mannequin (ADR 0013). The frames this record
> describes are deprecated: kept, unchanged, as a fallback for a move with no figure, and due
> to be removed ([#35](https://github.com/tukkteam/powerweek/issues/35)). The catalogue (names,
> equipment, muscles) still comes from Workout Guide as decided here.

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

## Update, 2026-11-24: the library is redrawn with one pen

The "breathing" turned out to be more than scale. Upstream's three frames per exercise are separate drawings: in 256 of the 302 exercises the line weight differs by more than 30 % between frames (in 68, by more than double), frames sit up to 40 units apart, 14 exercises have a frame cut off by the edge of the canvas and one frame (`pallof-press`, 2) is all but empty. Played in a row they flickered and jumped.

`pnpm moves` now redraws every frame instead of optimising it with SVGO: it finds the line down the middle of each stroke and draws it again as a stroked path at one weight, lines the frames of each exercise up on what stays still (the floor, or the bar for hanging exercises), fits each exercise to the canvas with the same margin, and lets the previous pose stand in for the empty frame. The method and its knobs are in `scripts/moves/art.mjs`; [docs/design-system.md](../design-system.md#exercise-illustrations) describes the result.

- The files are stroked paths now (`fill="none"`, one `stroke-width`), about the same size as before (6.0 MB for 906 frames). They are still masks in the app.
- The figures are simplified: lines drawn on a shape rather than round it (muscles, creases, machine details) are left out, so a drawing still reads at the size of a card.
- The key poses are still upstream's three. Where two keys are alike enough, a pose halfway between them is derived by matching their silhouettes and bending one drawing towards the other (`scripts/moves/tween.mjs`), and kept only if it holds together: 218 of 604 today, so 57 moves play through five poses, 104 through four and 141 through the three keys. Covering every move would take poses the library does not have: a rigged figure, or drawings made for the purpose. Either can keep the same slugs and file layout.
- A few frames cut off upstream stay cut off, and frames drawn very thick upstream keep less inner detail than their neighbours: the detail was never there.
- The changes are listed in `THIRD_PARTY_NOTICES.md` and `apps/web/public/moves/README.md`, as CC BY-SA 4.0 asks.
- `svgo` is no longer a dependency. Drawing needs `sharp`, which the web app already had.
