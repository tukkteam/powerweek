# Motion

PowerWeek should move like a well-made Apple app, and move the same way everywhere. That rests on three things, each in one place:

1. **The dial**: every speed, curve and spring is a token in [`packages/design-tokens/tokens.json`](../packages/design-tokens/tokens.json), under `motion`. Change a value there and the whole app moves differently.
2. **The recipes**: shared pieces of code for each kind of motion (a dialog, a screen change, a moving highlight, a list arriving). A new feature picks a recipe and gets the motion for free.
3. **The checks**: the build fails when an easing or a duration is typed in by hand, when a dialog skips its recipe, or when a screen forgets to slide.

If you're adding something that moves, read [Recipes](#recipes-what-to-use-for-what) and the [checklist](#checklist-for-a-pull-request-with-motion). If you want the app to feel different, read [The dial](#the-dial-change-how-the-whole-app-moves).

## The dial: change how the whole app moves

`tokens.json` → `motion` holds four groups. `pnpm tokens` turns them into CSS variables (`tokens.css`) and a TypeScript module (`motion.ts`, imported through `apps/web/lib/motion.ts`). Both are generated: never edit them by hand.

### Tempo

`motion.tempo` is a single number that multiplies every duration, every spring's response and the stagger step at build time. It's the knob for "everything a bit calmer" or "everything a bit snappier":

| `tempo` | Feel                                    |
| ------- | --------------------------------------- |
| `0.9`   | A tenth quicker everywhere.             |
| `1`     | The design as drawn (the default).      |
| `1.15`  | Calmer, more fluid: 15 % slower.        |
| `1.3`   | Noticeably slow; good for a demo video. |

It accepts 0.5 to 2. Loops (the tremble, the listening bars) keep their own rhythm.

### Springs

Movement uses springs, described as in SwiftUI: `response` is how long one swing takes without damping, in seconds (smaller is faster); `damping` is how quickly it stops swinging (1 never overshoots, lower values bounce more). The build simulates each spring and writes it two ways: a CSS `linear()` curve with the time it takes to settle (`--spring-bouncy`, `--spring-bouncy-duration`), and the stiffness and damping the `motion` library takes (`physics("bouncy")`). CSS and `motion` therefore play exactly the same spring.

| Token           | Response | Damping | Settles in | Use it for                                                                 |
| --------------- | -------- | ------- | ---------- | -------------------------------------------------------------------------- |
| `spring-snappy` | 0.28 s   | 0.85    | 400 ms     | Presses, toggles, a dialog closing: quick, almost no bounce.               |
| `spring-smooth` | 0.4 s    | 1       | 600 ms     | Moving between screens, one dialog turning into another: no bounce at all. |
| `spring-bouncy` | 0.38 s   | 0.72    | 620 ms     | A dialog opening, a pill sliding, a card dropped: about 4 % overshoot.     |

### Durations and easings

For fades, colour and anything that isn't movement.

| Token               | Value                               | Use it for                                                                      |
| ------------------- | ----------------------------------- | ------------------------------------------------------------------------------- |
| `duration-instant`  | 150 ms                              | Press feedback, hover colour, and the longest fade allowed with reduced motion. |
| `duration-quick`    | 200 ms                              | Fades, colour, borders, shadows.                                                |
| `duration-base`     | 260 ms                              | Small movements: a bar growing, a card rising in.                               |
| `duration-slow`     | 440 ms                              | Larger movements: the Day Bar resizing, blocks gliding, content arriving.       |
| `duration-glide`    | 700 ms                              | Progress: fills and numbers moving to a new value slowly enough to follow.      |
| `duration-stagger`  | 40 ms                               | The step between things arriving one after another.                             |
| `easing-standard`   | `cubic-bezier(0.2, 0.8, 0.2, 1)`    | The default: arriving, gliding, fading. Starts fast, lands softly.              |
| `easing-emphasized` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Small things that grow or pop in. Overshoots.                                   |
| `easing-exit`       | `cubic-bezier(0.3, 0, 1, 1)`        | Things leaving. Starts slow and gets out of the way.                            |
| `easing-sway`       | `cubic-bezier(0.42, 0, 0.58, 1)`    | Loops that go back and forth.                                                   |

### Changing a value

1. Edit `tokens.json` (the `usage` text says what each token is for; keep it true).
2. Run `pnpm tokens`.
3. Run `pnpm dev` and open **`/es/dev/motion`**: every spring, easing and duration side by side, and the recipes (a dialog, a hand-over, a cascade) to try. Each track can be sent back mid-flight to feel how the motion turns round.
4. Commit `tokens.json` with the generated `tokens.css` and `motion.ts`. CI fails if they disagree.

Want a new kind of motion that no token expresses? Add a token rather than a one-off value, with a `usage` line, and use it.

### Where the tokens are read

- **CSS**: `var(--easing-standard)`, `var(--duration-quick)`, `var(--spring-bouncy)` with `var(--spring-bouncy-duration)`.
- **Tailwind**: `ease-standard`, `ease-emphasized`, `ease-exit`, `ease-sway`; `duration-(--duration-quick)`. Tailwind's own `ease-in`, `ease-out` and `ease-in-out` are removed. A bare `transition` or `transition-colors` uses `duration-instant` and `easing-standard`.
- **TypeScript** (`@/lib/motion`): `durations`, `easings`, `bezier`, `springs` and `tempo`; `physics(name)` for `motion`; `springEasing(name)` for the Web Animations API (with a fallback for browsers without `linear()`); `ease(name)` to ease a number by hand on the same curve.

## Recipes: what to use for what

| You are building                                    | Use                                                                                     | What you get                                                                                                     |
| --------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| A form for a module (add or edit something)         | `EditorDialog` (`components/app/editor-dialog.tsx`)                                     | All of the dialog motion below, plus a form that sends one operation.                                            |
| Any other dialog, sheet or popover                  | A native `<dialog>` with `useDialogMotion(ref)` (`components/app/use-dialog-motion.ts`) | Grows out of what was tapped, backdrop fades, Escape and `close` shrink it back. Interruptible.                  |
| A detail whose button opens another dialog ("Edit") | `handOff()` from `useDialogMotion`, then open the other dialog                          | One window that changes size and content, instead of one leaving and another arriving. See `exercise-sheet.tsx`. |
| Content arriving inside a dialog or panel           | `className="pw-stagger"` on the container                                               | Each child rises in, `duration-stagger` after the one before.                                                    |
| A new screen in the app                             | Wrap the page in `<PageSlide>`; add it to `SCREENS`; links use `slideTo(from, to)`      | The screen slides in from the side its tab is on, the header holds still. `components/app/page-slide.tsx`.       |
| A segmented control or tabs with a moving highlight | One `motion.span` with a `layoutId`, `transition={physics("bouncy")}`                   | The highlight slides from option to option. See the Today/Week pill in `app-shell.tsx`.                          |
| Something appearing once (a card, a toast, a row)   | `pw-rise` (moves up a little), `pw-fade` (only fades), `pw-pop` (small things)          | An entrance on the tokens, already handled for reduced motion.                                                   |
| A bar that draws itself                             | `pw-reveal`                                                                             | Clips in from the left.                                                                                          |
| A number that changes                               | `useTween(value)` (`lib/use-tween.ts`)                                                  | Rolls to the new value on the same curve and time as a progress fill.                                            |
| Something pressed                                   | Nothing: any `button` or `role="button"` already presses; `pw-pressable` for a link     | Sinks and dims at once, springs back, lets go when you slide off. See [Pressing](#pressing).                     |
| A box with a long press                             | `useLongPress` and `pw-press`                                                           | The press, then a slower sink while held; one buzz when it fires.                                                |
| Completing something (a tick, a "done")             | `useJustDone(done)` → `pw-pop` on the check; `buzz("done")` in the handler              | The check pops in only when it changes, and phones that can vibrate buzz once (a setting, on by default).        |
| Something moved by hand                             | Track the pointer 1:1, then settle with `springs.bouncy` (`springEasing` or `physics`)  | See `panel-arranger.tsx` until the shared drag engine (#29).                                                     |
| An ambient loop                                     | A `@keyframes` with `var(--easing-sway)` and its own period, plus a reduced-motion stop | Allowed to keep its own rhythm.                                                                                  |
| Hover and colour                                    | `transition-colors` (already on the tokens)                                             | Nothing else to do.                                                                                              |

### Pressing

`PressFeedback` (`components/press-feedback.tsx`) is mounted once at the root and listens on the window, so there is nothing to wire up: every `button`, every `role="button"` and every `pw-pressable` (which `buttonClass` adds, so `ButtonLink` has it) answers the same way.

- **Down** (finger, mouse or Space/Enter): it scales over `duration-instant` and dims to `press.dim` brightness. The scale comes from its size (`pressScale` in `lib/motion.ts`): the edges move about `press.reach` pixels, so an icon button sinks to `press.deep` and a wide card only to `press.shallow`.
- **Up**: it springs back on `spring-snappy`, from wherever it is.
- **Slide off**: it lets go as the pointer leaves it and comes back if the pointer returns; released outside, the click that might follow is swallowed.
- **The action stays on `click`**, so keyboards and screen readers work as before.
- **Reduced motion**: no scale, only the dim, both ways in `duration-instant`.
- `data-press="none"` opts an element out, for things that already move under the finger. Disabled controls don't press, and fade (`opacity`) instead of jumping when they become disabled.

It uses the Web Animations API on the `scale` and `filter` properties, so it composes with whatever `transform`, `translate` or `rotate` the element has, and needs no class on it.

### A dialog

```tsx
const ref = useRef<HTMLDialogElement>(null);
const { close } = useDialogMotion(ref);

useEffect(() => {
  if (open && !ref.current?.open) ref.current?.showModal(); // the hook notices and grows it
}, [open]);

return (
  <dialog ref={ref} onClose={onClose} className="m-auto …">
    <div className="pw-stagger …">
      …<Button onClick={close}>{dict.common.close}</Button> {/* never ref.current.close() */}
    </div>
  </dialog>
);
```

Opening needs nothing beyond `showModal()`: the hook watches the dialog and grows it out of the button or card that was pressed (or the focused control, when the keyboard opened it). `onClose` still fires once the dialog is gone.

### A dialog that turns into another

```tsx
const { close, handOff } = useDialogMotion(ref);
// …
<Button
  onClick={() => {
    handOff(); // this dialog waits to morph into the next one
    onEdit(item); // the parent opens the editor in the same event
  }}
>
```

The two boxes meet in the middle, one fading out and the other in, and the new dialog inherits the way home: closing it shrinks into whatever opened the first one. If nothing opens within 400 ms, `handOff` closes the ordinary way.

### A screen

```tsx
// app/[lang]/app/<screen>/page.tsx
export default function Page() {
  return (
    <PageSlide>
      <ScreenView />
    </PageSlide>
  );
}
```

Add the screen to `SCREENS` in `page-slide.tsx`, in its place left to right, and give the links to it `transitionTypes={slideTo(currentScreen, "<screen>")}`.

### Which library does what

- **CSS** for presses, hovers, colour, entrances and loops.
- **React's `<ViewTransition>`** for moving between screens (React 19.3, no configuration in Next.js 16; see `apps/web/node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`). Without browser support the screen just swaps.
- **[Motion](https://motion.dev)** (formerly Framer Motion) for anything that must turn round mid-flight or carry velocity: dialogs, sliding highlights, gestures. Always feed it `physics(name)`, never its own presets. `MotionConfig reducedMotion="user"` in the app shell turns its movement off for people who ask for less motion.

Prefer extending a recipe over writing a new animation. If you do write one, make it a recipe: put it next to the others, list it here, and show it on `/es/dev/motion`.

## Six principles

What "Apple-level" means here. A reviewer can check each one.

1. **Springs, not just durations.** Movement uses springs, so it settles naturally. Durations are for fades and colour.
2. **Interruptible.** An animation can be reversed or redirected mid-flight (tap again, drag back) and continues from where it is, without jumping or restarting.
3. **1:1 under the finger.** During a gesture the element tracks the pointer exactly; the animation starts on release and carries the release velocity.
4. **Spatially coherent.** Things open from where they were tapped and close back into it; screens move in the direction of the tabs.
5. **Smooth on real devices.** Only `transform`, `opacity` and `filter` animate: never width, height, top or left. 60 fps on a mid-range Android phone with 4× CPU throttling, 120 fps where the screen allows it, and no long task (over 50 ms) during an animation.
6. **Respectful.** With `prefers-reduced-motion`, movement becomes a short fade (at most `duration-instant`) or nothing, and never removes information. Focus and screen-reader announcements never wait for an animation.

## Reduced motion

Asked in one place in each language. In CSS, the `prefers-reduced-motion` block at the end of `apps/web/app/globals.css`: add your class there if it moves. In code, `reducedMotion()` (at the moment of the call) and `useReducedMotion()` (follows changes while the page is open) from `lib/motion.ts`. The recipes already handle it: dialogs and screens fade in `duration-instant`, nothing grows, slides or cascades.

To try it: macOS System Settings → Accessibility → Display → Reduce motion, or Chrome DevTools → Rendering → Emulate CSS `prefers-reduced-motion`.

## What the build checks

Run by `pnpm verify` (and so by CI and `pnpm preflight`):

- **No hand-written motion** (`apps/web/lib/motion-literals.test.ts`): a `cubic-bezier(…)`, `linear(…)`, `ease` keyword, Tailwind `ease-out` or `duration-200`, or a duration typed into a transition, an animation, a Web Animations call or a `motion` call fails the build. Allowed on purpose: the period of an endless loop (`infinite`), delays (choreography), and the `linear` keyword.
- **Every dialog uses its recipe**: a file with a `<dialog>` must call `useDialogMotion`.
- **Every screen slides**: each `page.tsx` under `app/[lang]/app` wraps its content in `PageSlide`.
- **Generated files are current**: `tokens.css` and `motion.ts` match `tokens.json`.

`pnpm preflight` also warns, on the lines you added, about anything that looks like hand-written motion.

## Checklist for a pull request with motion

- [ ] It uses a recipe, or adds one (listed above and shown on `/es/dev/motion`).
- [ ] Every value comes from the tokens; a new kind of motion got a new token.
- [ ] Only `transform`, `opacity` and `filter` animate.
- [ ] It can be interrupted: tap again or press Escape halfway, and it turns round without a jump.
- [ ] It's checked with reduced motion on.
- [ ] A short screen recording in the pull request.

## Not there yet

- The Week Pulse bars (`pw-bar`, height and width), progress fills (`pw-fill`, width) and the Day Bar (`pw-track`, `pw-slide`) still animate layout properties (principle 5).
- Items arriving in and leaving a list (a new habit, a deleted note) appear and disappear at once.
- Switching days inside Today doesn't slide yet (#28), and dragging is not on the shared engine yet (#29).
