# Third-party notices

PowerWeek's own code is MIT licensed (see [LICENSE](LICENSE)). It ships these third-party works,
each under its own license.

## Exercise illustrations: Workout Guide and Everkinetic (CC BY-SA 4.0)

- Files: `apps/web/public/moves/**` (906 SVG frames, three per exercise).
- Source: [Workout Guide](https://github.com/bryllim/workout-guide) by Bryl Lim, commit
  `aac5992`, whose pose artwork builds on [Everkinetic](https://github.com/everkinetic/data).
- License: [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/).
- Changes: optimised with SVGO (coordinates rounded to whole units, fill colour removed); the app
  tints them at render time with CSS masks. The adapted files keep the CC BY-SA 4.0 license.
- Per-frame credits, including the Everkinetic source of each adapted pose, are in the upstream
  [manifest](https://github.com/bryllim/workout-guide/blob/aac599224bb9780305239607ef98540b7e0ce389/packages/workout-guide/manifest.json).
- Regenerate with `pnpm moves` ([scripts/moves.mjs](scripts/moves.mjs)).

## Exercise catalogue: Workout Guide (MIT)

`packages/core/src/moves-data.ts` is generated from Workout Guide's `manifest.json` (names,
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

`apps/web/components/app/body-data.ts` holds the front and back body polygons from
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
