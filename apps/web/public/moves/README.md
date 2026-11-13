# Move library artwork

The exercise illustrations in this folder come from **Workout Guide** by Bryl Lim
(https://github.com/bryllim/workout-guide, commit `aac5992`), whose pose artwork builds on
**Everkinetic** (https://github.com/everkinetic/data).

- License: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0),
  https://creativecommons.org/licenses/by-sa/4.0/
- Changes: optimised with SVGO (coordinates rounded to whole units, fill colour removed).
  PowerWeek tints them at render time with CSS masks.
- These adapted files are shared under the same license. The rest of PowerWeek is MIT.
- Per-frame credits, including the Everkinetic source of each adapted pose, are listed in the
  upstream manifest: https://github.com/bryllim/workout-guide/blob/aac599224bb9780305239607ef98540b7e0ce389/packages/workout-guide/manifest.json

Regenerate with `pnpm moves` (see scripts/moves.mjs).
