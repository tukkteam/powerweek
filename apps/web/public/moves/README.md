# Move library artwork

The exercise illustrations in this folder come from **Workout Guide** by Bryl Lim
(https://github.com/bryllim/workout-guide, commit `aac5992`), whose pose artwork builds on
**Everkinetic** (https://github.com/everkinetic/data).

- License: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0),
  https://creativecommons.org/licenses/by-sa/4.0/
- Changes: every frame is redrawn. Upstream's traced outlines are reduced to the line down the
  middle of each stroke and drawn again with a single pen (stroke width 4.2 on the 512
  canvas), so every frame of every exercise has the same line weight; marks drawn inside the
  figures (muscles, creases, machine details) are left out; the three frames of each
  exercise are moved and scaled so that what stays still (the floor, a bench, a bar) lies in
  the same place; and each exercise is fitted to the canvas with the same margin. The three
  poses of each exercise are upstream's. Files named 1-2.svg and 2-3.svg are new: a pose
  halfway between two of upstream's, made by bending the first until its outline is halfway
  to the second's (only where that holds together). PowerWeek tints the drawings at render
  time with CSS masks.
- These adapted files are shared under the same license. The rest of PowerWeek is MIT.
- Per-frame credits, including the Everkinetic source of each adapted pose, are listed in the
  upstream manifest: https://github.com/bryllim/workout-guide/blob/aac599224bb9780305239607ef98540b7e0ce389/packages/workout-guide/manifest.json

Regenerate with `pnpm moves` (see scripts/moves.mjs).
