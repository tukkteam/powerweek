# Design system

PowerWeek looks like an athletic scoreboard: a dark ground, one electric colour (**volt**, `#d4ff3a`), wide uppercase type and a week that pulses. Night (dark) is the primary theme; Day (light) mirrors it.

The system was designed with Claude's design tools and is published as a Claude Design System artifact. The **same `tokens.json`** lives in this repo at [`packages/design-tokens/tokens.json`](../packages/design-tokens/tokens.json), so design and code share one source.

## Tokens to CSS to Tailwind

```
packages/design-tokens/tokens.json   (edit here, or in the design artifact and copy back)
        │  pnpm tokens  (scripts/build.mjs; CI runs it with --check)
        ▼
packages/design-tokens/tokens.css    :root / [data-theme="dark|light|system"] custom properties
        │  @import in apps/web/app/globals.css
        ▼
Tailwind utilities                   bg-surface, text-ink-muted, border-line, text-volt-ink, …
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

| Component      | Where                                                | Notes                                                                                                                                                                                              |
| -------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Week Pulse     | `components/app/week-pulse.tsx`                      | Seven capsules, Monday first, length = day load; today in volt; pulses while listening. Phones: a row above the day. Desktop: a column beside the Day Bar, same height, so tall days stay balanced |
| Week Stack     | `components/app/week-stack.tsx`                      | The Week Pulse split by category: agenda (blue), training (volt) and meals (orange) stacked in each capsule                                                                                        |
| Day Bar        | `components/app/day-bar.tsx`                         | The day as one progress bar (06:00–24:00): a volt rail fills with the clock, blocks fill as their own time passes                                                                                  |
| Agenda bars    | `components/app/agenda-box.tsx`                      | Timed items are progress bars from start to end with a status (Ahora, En 2 h, Hecho); untimed items keep a round tick                                                                              |
| Fuel gauge     | `components/app/fuel-box.tsx`                        | Four slots that fill orange as meals are planned; the slot due now is ringed                                                                                                                       |
| Training board | `components/app/train-box.tsx`, `exercise-sheet.tsx` | Muscle map + one illustrated tile per exercise, sets drawn as volt pills, one "workout done" button. No per-exercise ticks                                                                         |
| Move art       | `components/app/move-art.tsx`                        | Exercise line drawings used as CSS masks, so they paint in the current colour. Animated: frames 1 → 2 → 3 → 2 with cross-fades                                                                     |
| Muscle map     | `components/app/muscle-map.tsx`                      | Low-poly front and back figures; muscles glow in four steps of volt by training volume                                                                                                             |
| Week board     | `components/app/week-view.tsx`, `day-peek.tsx`       | One big box per day with a blue, a volt and an orange box inside, in fixed columns. Hover or press and hold to peek                                                                                |
| Voice Dock     | `components/app/voice-dock.tsx`                      | The one primary input per screen: orb + field; states idle, listening, thinking                                                                                                                    |
| Change Receipt | `components/app/change-receipt.tsx`                  | `+` added, `~` changed, `→` moved, `−` removed; Undo; auto-dismiss unless hovered or focused                                                                                                       |

### Category colours

Every category keeps one colour everywhere: **Agenda is blue** (`agenda`), **Training is volt** (`train`, the brand colour) and **Meals are orange** (`fuel`). Boxes use a 7 % tint of the colour as ground and a 30 % edge; bars and fills use the full colour with `bg` text on top, which keeps at least 4.5:1 in both themes. The classes live in [`lib/tone.ts`](../apps/web/lib/tone.ts).

### Bars all the way down

The Week Pulse is the model for the whole interface: quantities are drawn as bars that grow. The week grows by load (Week Pulse, Week Stack), the day fills with the clock (Day Bar), each appointment fills from its start to its end, meals fill a four-slot gauge and the sets of an exercise are pills. Prefer a bar to a number, and a number to a sentence.

### Training without ticks

At the gym nobody wants to tick boxes between sets. Exercises are tiles you glance at: the movement drawn, the sets as pills, reps and load in mono. Opening a tile shows the animated movement, its three phases and the muscles it works. The session is marked done once, with one button.

### Exercise illustrations

Drawings come from the move library (see [ADR 0008](adr/0008-move-library.md)): 302 exercises with three frames each, served from `apps/web/public/moves/<slug>/<frame>.svg`. They are masks, never `<img>`, so the brand colour drives them; frame 1 is the still image, and animation only runs on hover, focus or in the exercise sheet (and never with reduced motion). Credits: Workout Guide by Bryl Lim, based on Everkinetic, CC BY-SA 4.0.

## Voice and copy

Spanish first (tú), English second, same tone: imperative, short and warm. "Dile a tu semana qué hacer." / "Talk your week into shape." Sentence case except display styles and labels. Times in 24 h, `4 × 8` with the multiplication sign, `80 kg` with a space. Empty states quote a real command. No emoji in the interface.

## Motion and accessibility

Bars spring (about 240 ms), progress fills glide (700 ms), everything else eases out in 160–220 ms; `prefers-reduced-motion` turns motion into fades and stops illustration loops. Hover details appear after 320 ms and never take the pointer; on touch screens a 450 ms press opens the same detail as a bottom sheet, and a normal tap always opens the day. Touch targets are at least 44 px, icon-only buttons have labels, dialogs use the native `<dialog>` element, and the receipt and notices are live regions.
