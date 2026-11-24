# Third-party notices

PowerWeek's own code is MIT licensed (see [LICENSE](LICENSE)). It ships these third-party works,
each under its own license.

## Exercise illustrations: Workout Guide and Everkinetic (CC BY-SA 4.0)

- Files: `apps/web/public/moves/**` (906 SVG frames, three per exercise).
- Source: [Workout Guide](https://github.com/bryllim/workout-guide) by Bryl Lim, commit
  `aac5992`, whose pose artwork builds on [Everkinetic](https://github.com/everkinetic/data).
- License: [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/).
- Changes: every frame is redrawn. Upstream's traced outlines are reduced to the line down the
  middle of each stroke and drawn again with a single pen, so every frame of every exercise has
  the same line weight; the three frames of each exercise are moved and scaled so that what stays
  still (the floor, a bench, a bar) lies in the same place; each exercise is fitted to the canvas
  with the same margin; and one frame that is all but empty upstream (`pallof-press`, frame 2)
  is replaced by the pose before it. Poses are not altered. The app tints the drawings at render
  time with CSS masks. The adapted files keep the CC BY-SA 4.0 license.
- Per-frame credits, including the Everkinetic source of each adapted pose, are in the upstream
  [manifest](https://github.com/bryllim/workout-guide/blob/aac599224bb9780305239607ef98540b7e0ce389/packages/workout-guide/manifest.json).
- Regenerate with `pnpm moves` ([scripts/moves.mjs](scripts/moves.mjs)).

## Exercise catalogue: Workout Guide (MIT)

`apps/web/modules/train/moves-data.ts` is generated from Workout Guide's `manifest.json` (names,
equipment, muscles).

```
MIT License

Copyright (c) 2026 Bryl Lim

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Muscle map outlines: react-body-highlighter (MIT)

`apps/web/modules/train/body-data.ts` holds the front and back body polygons from
[react-body-highlighter](https://github.com/giavinh79/react-body-highlighter).

```
MIT License

Copyright (c) 2020 GV79

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Fonts (SIL Open Font License 1.1)

- Archivo, bundled for the Open Graph image in `apps/web/assets/fonts` (license alongside it) and
  served through `next/font`.
- Geist Mono, served through `next/font`.
