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

## Voice and copy

Spanish first (tú), English second, same tone: imperative, short and warm. "Dile a tu semana qué hacer." / "Talk your week into shape." Sentence case except display styles and labels. Times in 24 h, `4 × 8` with the multiplication sign, `80 kg` with a space. Empty states quote a real command. No emoji in the interface.

## Motion and accessibility

PowerWeek should move like a well-made Apple app: one way of moving, everywhere. Motion is built from tokens, like colour, and the build fails when an easing or a duration is typed in by hand.

### Six principles

A reviewer can check each of these.

1. **Springs, not just durations.** Movement uses springs defined by response and damping, as in SwiftUI, so it settles naturally. Durations are for fades and colour.
2. **Interruptible.** An animation can be reversed or redirected mid-flight (tap again, drag back) and continues from where it is, without jumping or restarting.
3. **1:1 under the finger.** During a gesture the element tracks the pointer exactly; the animation starts on release and carries the release velocity.
4. **Spatially coherent.** Things open from where they were tapped and close back into it; navigation moves in the direction of the tabs.
5. **Smooth on real devices.** Only `transform`, `opacity` and `filter` animate: never width, height, top or left. 60 fps on a mid-range Android phone with 4× CPU throttling, 120 fps where the screen allows it, and no long task (over 50 ms) during an animation.
6. **Respectful.** With `prefers-reduced-motion`, movement becomes a short fade (at most `duration-instant`, 150 ms) or nothing, and never removes information. Focus and screen-reader announcements never wait for an animation.

Still to bring in line with principle 5: the Week Pulse bars (`pw-bar`, height and width), progress fills (`pw-fill`, width) and the Day Bar (`pw-track`, `pw-slide`: min-height, top, left, width). The motion issues for presses (#26), details (#27), tabs (#28) and dragging (#29) take them on.

### Motion tokens

In `tokens.json` under `motion`; `pnpm tokens` writes them to `tokens.css` and `motion.ts`.

| Token               | Value                               | Use it for                                                                                            |
| ------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `easing-standard`   | `cubic-bezier(0.2, 0.8, 0.2, 1)`    | The default: entrances, glides, fills, fades, colour. Starts fast, lands softly.                      |
| `easing-emphasized` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Small things that grow or appear: Week Pulse bars, controls popping in. Overshoots.                   |
| `easing-exit`       | `cubic-bezier(0.3, 0, 1, 1)`        | Things leaving: a sheet closing, a card dismissed.                                                    |
| `easing-sway`       | `cubic-bezier(0.42, 0, 0.58, 1)`    | Loops that go back and forth: listening bars, a breathing dot, the tremble.                           |
| `duration-instant`  | 150 ms                              | Press feedback, hover colour, and the longest fade allowed with reduced motion.                       |
| `duration-quick`    | 200 ms                              | Fades, colour, borders, shadows.                                                                      |
| `duration-base`     | 260 ms                              | Small movements: a bar growing, a card rising in, a tile settling.                                    |
| `duration-slow`     | 440 ms                              | Larger movements: the Day Bar resizing, blocks gliding, a pressed box sinking.                        |
| `duration-glide`    | 700 ms                              | Progress: fills and numbers moving to a new value slowly enough to follow.                            |
| `spring-snappy`     | response 0.28 s, damping 0.85       | Presses and toggles: quick, almost no bounce. Settles in 400 ms.                                      |
| `spring-smooth`     | response 0.4 s, damping 1           | Opening and closing details, moving between screens: no bounce. Settles in 600 ms.                    |
| `spring-bouncy`     | response 0.38 s, damping 0.72       | Things moved by hand: a dropped card, neighbours making room. About 4 % overshoot, settles in 620 ms. |

A spring's `response` is its period without damping, in seconds (smaller is faster); `damping` is the damping ratio (1 settles without overshooting). The build samples each spring every 20 ms until it stays within 0.1 % of its target (`scripts/spring.mjs`) and writes it as a CSS `linear()` easing with its duration. Where `linear()` is not understood (Safari before 17.2), the `--spring-*` variables fall back to the standard easing.

Where to read them:

- **CSS**: `var(--easing-standard)`, `var(--duration-quick)`, `var(--spring-bouncy)` with `var(--spring-bouncy-duration)`.
- **Tailwind**: `ease-standard`, `ease-emphasized`, `ease-exit`, `ease-sway`; `duration-(--duration-quick)`. Tailwind's own easings (`ease-in`, `ease-out`, `ease-in-out`) are removed. A bare `transition` or `transition-colors` uses `duration-instant` and `easing-standard`.
- **TypeScript**: `durations`, `easings`, `springs` from `@/lib/motion`, plus `springEasing(name)` for the Web Animations API (with the same fallback) and `ease(name)` to ease a number by hand on the same curve (`useTween` does, so a number and its fill arrive together).

To tune them, run `pnpm dev` and open `/es/dev/motion`: every spring, easing and duration side by side, and each track can be sent back mid-flight. That page exists only in development (`page.dev.tsx`; see `pageExtensions` in `next.config.ts`).

### Which tool for which motion

- **Presses, hovers and colour**: CSS transitions on the tokens.
- **Moving between screens**: React's `<ViewTransition>` (React 19.3; no configuration in Next.js 16, see `apps/web/node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`). Today, Week and Settings sit left to right in that order; each link says which way it goes (`transitionTypes`, from `slideTo` in `components/app/page-slide.tsx`) and each page is wrapped in `PageSlide`, so the old screen slides out and the new one in beside it, on `spring-smooth`. The header and the Voice Dock hold still above it. The browser's back button just swaps, and without View Transitions support nothing breaks.
- **Dialogs, the tab pill and anything that must turn round mid-flight**: `motion` (Motion, formerly Framer Motion), fed with our springs through `physics(name)` in `lib/motion.ts`, so the library plays exactly the springs CSS does. A spring in `motion` keeps its velocity when it is interrupted, which is what makes principle 2 hold: close a dialog while it is still opening and it heads home from where it is.
  - Every dialog uses `useDialogMotion` (`components/app/use-dialog-motion.ts`): it grows out of what was tapped (or the focused control, for the keyboard) on `spring-bouncy`, its backdrop fades, its content arrives in a short cascade (`pw-stagger`), and closing, by button or Escape, shrinks it back into where it came from on `spring-snappy`. Use the `close` it returns instead of `dialog.close()`.
  - The Today/Week pill is one element handed from tab to tab (`layoutId`), so it slides across on `spring-bouncy`.
  - `MotionConfig reducedMotion="user"` in the app shell turns its movement off for people who ask for less motion.
- **Gestures** (drag, swipe to dismiss): `motion` too, for the same reason. Until the shared drag engine (#29) arrives, arranging uses pointer events and the Web Animations API with `spring-bouncy`.

### What the build checks

`lib/motion-literals.test.ts` reads every stylesheet and component in `apps/web` and fails on a hand-written easing (`cubic-bezier(…)`, `linear(…)`, an `ease` keyword, a Tailwind `ease-out` or `duration-200`) or a hand-written duration in a transition, an animation or a Web Animations call. Three things may stay local on purpose: the period of an endless loop (an animation with `infinite`, such as the tremble or the listening bars, is the rhythm of that one element), delays (choreography, such as a stagger), and the `linear` keyword. A new kind of motion that the tokens can't express is a new token: add it to `tokens.json`, run `pnpm tokens`, and look at it on `/es/dev/motion`.

### Reduced motion

Asked in one place in each language. In CSS, the `prefers-reduced-motion` block at the end of `app/globals.css`. In code, `reducedMotion()` (at the moment of the call) and `useReducedMotion()` (a hook that follows changes while the page is open) from `lib/motion.ts`. Both are tested. With reduced motion, dialogs and screens fade in and out in `duration-instant`; nothing grows, slides or cascades.

### Accessibility

Hover details appear after 320 ms and never take the pointer; on touch screens a 450 ms press opens the same detail as a bottom sheet, and a normal tap always opens the day. Touch targets are at least 44 px, icon-only buttons have labels, dialogs use the native `<dialog>` element, and the receipt and notices are live regions.

Arranging the panel works with a mouse, a finger and a keyboard. On a card's handle, Space or Enter picks the card up, the arrow keys move it one place (up and left earlier, down and right later), Home and End to either end, Space or Enter drops it and Escape puts it back; each step is announced in a live region, in the interface language. While arranging, each card trembles at its own pace, turned by an angle set from its width so wide and narrow cards move their edges the same (`trembleAngle` in `lib/motion.ts`); its dashed edge marches slowly round it; the controls pop in, staggered, and hold still. A card in hand grows a little on a spring, its edge turns solid and glows in its tone, and it tracks the pointer 1:1; neighbours and the drop move on the same spring (`spring-bouncy`). With reduced motion nothing trembles, marches, pops, lifts or glides.
