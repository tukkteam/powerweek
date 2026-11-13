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

| Component                | Where                               | Notes                                                                                        |
| ------------------------ | ----------------------------------- | -------------------------------------------------------------------------------------------- |
| Week Pulse               | `components/app/week-pulse.tsx`     | Seven capsules, Monday first, height = day load. Today in volt; pulses while listening       |
| Voice Dock               | `components/app/voice-dock.tsx`     | The one primary input per screen: orb + field; states idle, listening, thinking              |
| Change Receipt           | `components/app/change-receipt.tsx` | `+` added, `~` changed, `→` moved, `−` removed; Undo; auto-dismiss unless hovered or focused |
| Section card + Plan item | `components/app/today-view.tsx`     | Agenda, Training, Fuel; tick = done today                                                    |

## Voice and copy

Spanish first (tú), English second, same tone: imperative, short and warm. "Dile a tu semana qué hacer." / "Talk your week into shape." Sentence case except display styles and labels. Times in 24 h, `4 × 8` with the multiplication sign, `80 kg` with a space. Empty states quote a real command. No emoji in the interface.

## Motion and accessibility

Bars spring (about 240 ms), everything else eases out in 160–220 ms; `prefers-reduced-motion` turns motion into fades. Touch targets are at least 44 px, icon-only buttons have labels, dialogs use the native `<dialog>` element, and the receipt and notices are live regions.
