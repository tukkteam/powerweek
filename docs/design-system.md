# Design system

PowerWeek looks like an athletic scoreboard: a dark ground, one electric colour (**volt**, `#d4ff3a`), wide uppercase type and a week that pulses. Night (dark) is the primary theme; Day (light) mirrors it.

The system was designed with Claude's design tools and is published as a Claude Design System artifact. The **same `tokens.json`** lives in this repo at [`packages/design-tokens/tokens.json`](../packages/design-tokens/tokens.json), so design and code share one source.

## Tokens to CSS to Tailwind

```
packages/design-tokens/tokens.json   (edit here, or in the design artifact and copy back)
        │  pnpm tokens  (scripts/build.mjs; CI runs it with --check)
        ▼
packages/design-tokens/tokens.css    :root / [data-theme="dark|light|system"] custom properties
packages/design-tokens/motion.ts     the motion tokens for TypeScript (@powerweek/design-tokens/motion)
        │  @import in apps/web/app/globals.css; motion.ts through apps/web/lib/motion.ts
        ▼
Tailwind utilities                   bg-surface, text-ink-muted, border-line, ease-standard, …
```

Themes switch by setting `data-theme` on `<html>` (`dark`, `light` or `system`); the choice is stored in `localStorage` and applied before first paint.

## Colour rules

| Token                             | Use                                                                                                 |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| `bg`, `surface`, `surface-raised` | Page ground, cards, things that float (dock, receipt, dialogs)                                      |
| `ink`, `ink-muted`                | Primary and secondary text (≥ 6:1 on every ground, both themes)                                     |
| `line`, `line-strong`             | Hairlines; control borders (≥ 3:1)                                                                  |
| `volt` + `on-volt`                | The only loud fill: primary buttons, the microphone orb. Text on it is `on-volt`                    |
| `volt-ink`                        | Volt as text, thin marks or small fills on light grounds (olive in the Day theme so it stays ≥ 5:1) |
| `agenda`, `train`, `fuel`         | Category colours, always paired with an icon or a label                                             |
| `danger`                          | Errors and destructive actions, always with an icon and a word                                      |
| `focus`                           | 2 px solid focus ring, offset 2 px                                                                  |

Every text pair passes WCAG AA in both themes; the palette was checked with a contrast script before it was published.

## Type

- **Archivo** (variable, self-hosted with `next/font`): display styles at `font-stretch: 125%`, weight 900, uppercase (`type-display-xl`, `type-display`); `type-title` at 112%; UI text at normal width (`type-heading`, `type-body`, `type-caption`).
- **Geist Mono** for data: `type-numeric` (times, sets × reps, tabular figures) and `type-label` (uppercase tags, letter-spacing 0.12em).

## Signature components

| Component      | Where                                               | Notes                                                                                                                                                                                              |
| -------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Week Pulse     | `components/app/week-pulse.tsx`                     | Seven capsules, Monday first, length = day load; today in volt; pulses while listening. Phones: a row above the day. Desktop: a column beside the Day Bar, same height, so tall days stay balanced |
| Week Stack     | `components/app/week-stack.tsx`                     | The Week Pulse split by module: what each module on screen plans, stacked in each capsule in its tone                                                                                              |
| Day Bar        | `components/app/day-bar.tsx`                        | The day as one progress bar (06:00–24:00): a volt rail fills with the clock; any module places blocks and markers on it                                                                            |
| Agenda bars    | `modules/agenda/views.tsx`                          | Timed items are progress bars from start to end with a status (Ahora, En 2 h, Hecho); untimed items keep a round tick                                                                              |
| Fuel gauge     | `modules/fuel/views.tsx`                            | Four slots that fill as meals are planned; the slot due now is ringed                                                                                                                              |
| Training board | `modules/train/views.tsx`, `exercise-sheet.tsx`     | Muscle map + one illustrated tile per exercise, sets drawn as volt pills, one "workout done" button. No per-exercise ticks                                                                         |
| Move art       | `modules/train/move-art.tsx`                        | Exercise line drawings used as CSS masks, so they paint in the current colour. Animated: frames 1 → 2 → 3 → 2 with cross-fades                                                                     |
| Muscle map     | `modules/train/muscle-map.tsx`                      | Low-poly front and back figures; muscles glow in four steps of volt by training volume                                                                                                             |
| Week board     | `components/app/week-view.tsx`                      | One big box per day with one box per module inside, in fixed columns. Hover or press and hold to peek                                                                                              |
| Panel arranger | `components/app/panel-arranger.tsx`                 | The panel in edit mode: the real cards, asleep, edged in their tone. Drag (on touch: hold, or the handle), minus to take off, keys or arrows to move, list to add. Done saves                      |
| Module desk    | `components/app/module-desk.tsx`                    | The welcome for a blank screen: tiles that tremble, tap to add, drag to reorder, "Start" saves                                                                                                     |
| Module card    | `components/app/module-card.tsx`, `module-slot.tsx` | The chrome module cards share, and the slot that gives a module its tone and contains its failures                                                                                                 |
| Voice Dock     | `components/app/voice-dock.tsx`                     | The one primary input per screen: orb + field; states idle, listening, thinking                                                                                                                    |
| Change Receipt | `components/app/change-receipt.tsx`                 | `+` added, `~` changed, `→` moved, `−` removed; Undo; auto-dismiss unless hovered or focused                                                                                                       |

### Module tones

Every module keeps one colour everywhere. A module names a **tone** and the host sets it on the element that wraps the module (`toneStyle` in [`modules/look.tsx`](../apps/web/modules/look.tsx)); inside, views never name a colour: they write `text-tone`, `bg-tone`, `bg-tone/15`. That is what lets a new module, or a person, pick a colour without touching a view.

There are seven tones: `blue` (Agenda), `volt` (Training, the brand colour), `orange` (Meals), `sand` (Notes), `teal` (Habits), `violet` and `rose`. Each is a pair of colours, Night and Day. Boxes use a 7 % tint of the tone as ground and a 30 % edge; bars and fills use the full tone.

A tone has three jobs, and [`scripts/tones.mjs`](../packages/design-tokens/scripts/tones.mjs) checks all three on every build:

- **Text:** at least 4.5:1 on `bg`, `surface` and `surface-raised`.
- **Fill:** at least 4.5:1 under text in the `bg` colour.
- **Next to another tone:** every pair stays apart for people with red-green colour blindness (OKLab ΔE×100 of 8 or more under simulated protanopia and deuteranopia) and for full colour vision (15 or more). That is why there are seven tones and not more: the four added to the brand's three were computed, not picked by eye, and a tone that sits too close to another fails the build.

One pair is a known exception: by Day, Training (`volt`) and Meals (`orange`) are hard to tell apart with red-green colour blindness (4.6). Both colours predate the check, and changing either is a brand decision. Tones are never the only cue: every module also has an icon and a name.

### Bars all the way down

The Week Pulse is the model for the whole interface: quantities are drawn as bars that grow. The week grows by load (Week Pulse, Week Stack), the day fills with the clock (Day Bar), each appointment fills from its start to its end, meals fill a four-slot gauge and the sets of an exercise are pills. Prefer a bar to a number, and a number to a sentence.

### Meal options

A meal slot can hold a range of options ("abanico") instead of one dish, shared by the week or for one day. In Today they are chips: tap one to choose it for that date (orange, with a check; the others dim), tap again to undo. Until you choose, the slot's gauge shows one dim segment per option and the Day Bar marker is dashed.

### Training without ticks

At the gym nobody wants to tick boxes between sets. Exercises are tiles you glance at: the movement drawn, the sets as pills, reps and load in mono. Opening a tile shows the animated movement, its three phases and the muscles it works. The session is marked done once, with one button.

### Exercise illustrations

Drawings come from the move library (see [ADR 0008](adr/0008-move-library.md)): 302 exercises with three frames each, served from `apps/web/public/moves/<slug>/<frame>.svg`. They are masks, never `<img>`, so the brand colour drives them; frame 1 is the still image, and animation only runs on hover, focus or in the exercise sheet (and never with reduced motion). Credits: Workout Guide by Bryl Lim, based on Everkinetic, CC BY-SA 4.0.

Upstream, the three frames of an exercise are three separate drawings: hair-thin lines in one, marker-thick in the next, at slightly different sizes and places, so played in a row they flickered and jumped. `pnpm moves` therefore redraws the whole library with one pen (`scripts/moves/art.mjs`):

- **One line weight.** Each frame is reduced to the line down the middle of every stroke and drawn again as a stroked path. Every frame of every exercise has the same `stroke-width` (`PEN.weight`, in units of the 512 canvas), round ends and round joins. To make the whole library bolder or finer, change that one number and run `pnpm moves`.
- **Frames that sit on each other.** The frames of an exercise are moved and scaled (never bent) until what stays still lies in the same place: the floor for nearly everything, the bar where the body hangs from one (`anchorOf`). Where nothing stays still (jumps, dips) upstream's placement is kept.
- **The same fit.** Every exercise fills the canvas up to the same margin, so cards look alike.
- **A rhythm like a repetition.** The loop rests on the first and last pose and passes through the middle one; each change is a short overlap, so the drawing never dims (`pw-frame-*` in `app/globals.css`).

The poses themselves are upstream's: three key poses per exercise, not in-between frames. `modules/train/move-art.test.ts` checks the committed files (one weight, inside the canvas, no empty frame), and `scripts/moves/moves.test.mjs` the pipeline. `pnpm moves --report FILE` writes what was done to each move. To look at the whole library playing at once, run `pnpm dev` and open `/es/dev/moves` (development only).

## Voice and copy

Spanish first (tú), English second, same tone: imperative, short and warm. "Dile a tu semana qué hacer." / "Talk your week into shape." Sentence case except display styles and labels. Times in 24 h, `4 × 8` with the multiplication sign, `80 kg` with a space. Empty states quote a real command. No emoji in the interface.

## Motion and accessibility

Motion has its own guide: **[docs/motion.md](motion.md)**. It covers the tokens (including `tempo`, the one dial for the whole app's pace), the recipes to use for dialogs, screens and the rest, the six principles, reduced motion and what the build checks.

### Accessibility

Hover details appear after 320 ms and never take the pointer; on touch screens a 450 ms press opens the same detail as a bottom sheet, and a normal tap always opens the day. Touch targets are at least 44 px, icon-only buttons have labels, dialogs use the native `<dialog>` element, and the receipt and notices are live regions.

Arranging the panel works with a mouse, a finger and a keyboard. On a card's handle, Space or Enter picks the card up, the arrow keys move it one place (up and left earlier, down and right later), Home and End to either end, Space or Enter drops it and Escape puts it back; each step is announced in a live region, in the interface language. While arranging, each card trembles at its own pace, turned by an angle set from its width so wide and narrow cards move their edges the same (`trembleAngle` in `lib/motion.ts`); its dashed edge marches slowly round it; the controls pop in, staggered, and hold still. A card in hand grows a little on a spring, its edge turns solid and glows in its tone, and it tracks the pointer 1:1; neighbours and the drop move on the same spring (`spring-bouncy`). With reduced motion nothing trembles, marches, pops, lifts or glides.
