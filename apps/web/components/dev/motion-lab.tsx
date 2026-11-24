"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useDialogMotion } from "@/components/app/use-dialog-motion";
import { Button } from "@/components/ui/button";
import {
  durations,
  easings,
  springs,
  tempo,
  useReducedMotion,
  type EasingName,
  type SpringName,
} from "@/lib/motion";

type DurationName = keyof typeof durations;

const pointsOf = (easing: string) => easing.slice("linear(".length, -1).split(",").map(Number);

/** The shape of a spring: time across, position up, with room above 1 for the overshoot. */
function Curve({ points }: { points: number[] }) {
  const top = 1.1;
  const path = points
    .map((p, i) => `${((i / (points.length - 1)) * 100).toFixed(2)},${((top - p) * 40).toFixed(2)}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 48" className="h-12 w-28 shrink-0 text-tone" aria-hidden="true">
      <line x1="0" x2="100" y1={(top - 1) * 40} y2={(top - 1) * 40} className="stroke-line" />
      <polyline points={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * A dot that crosses its track and back each time `there` flips. Press the track while it moves
 * to see how the transition turns round from where it is.
 */
function Track({
  there,
  style,
  onFlip,
}: {
  there: boolean;
  style: CSSProperties;
  onFlip: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onFlip}
      aria-label="Send the dot the other way"
      className="relative h-11 min-w-0 flex-1 rounded-full border border-line bg-bg"
    >
      <span className="absolute inset-y-0 right-11 left-1 block">
        <span
          className="absolute inset-y-0 left-0 flex w-full items-center transition-transform"
          style={{ ...style, transform: there ? "translateX(100%)" : "none" }}
        >
          <span className="size-9 rounded-full bg-tone" />
        </span>
      </span>
    </button>
  );
}

function Row({ name, detail, children }: { name: string; detail: string; children: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-4 rounded-[14px] border border-line bg-surface p-4">
      <div className="w-40 shrink-0">
        <p className="type-heading">{name}</p>
        <p className="font-mono text-[0.8125rem] text-ink-muted">{detail}</p>
      </div>
      {children}
    </li>
  );
}

export function MotionLab() {
  const reduced = useReducedMotion();
  const [there, setThere] = useState<Record<string, boolean>>({});
  const [all, setAll] = useState(false);
  const [easeFor, setEaseFor] = useState<DurationName>("slow");
  const flip = (key: string) => setThere((t) => ({ ...t, [key]: !(t[key] ?? all) }));
  const at = (key: string) => there[key] ?? all;
  const playAll = () => {
    setThere({});
    setAll((a) => !a);
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="type-display">Motion tokens</h1>
          <p className="type-body text-ink-muted">
            From packages/design-tokens/tokens.json, at tempo {tempo} (motion.tempo: the one dial
            for the whole app&apos;s pace; see docs/motion.md). Press a track to send its dot the
            other way mid-flight.
            {reduced ? " Reduced motion is on: the app replaces these with fades or nothing." : ""}
          </p>
        </div>
        <Button variant="primary" onClick={playAll}>
          Play all
        </Button>
      </header>

      <Recipes />

      <section
        className="flex flex-col gap-3"
        style={{ "--tone": "var(--tone-volt)" } as CSSProperties}
      >
        <h2 className="type-title">Springs</h2>
        <p className="type-body text-ink-muted">
          Movement. Response and damping as in SwiftUI; played by CSS as a linear() curve.
        </p>
        <ul className="flex flex-col gap-3">
          {(Object.keys(springs) as SpringName[]).map((name) => {
            const spring = springs[name];
            return (
              <Row
                key={name}
                name={name}
                detail={`${spring.response} s · ${spring.damping} · ${spring.duration} ms`}
              >
                <Curve points={pointsOf(spring.easing)} />
                <Track
                  there={at(`spring-${name}`)}
                  onFlip={() => flip(`spring-${name}`)}
                  style={{
                    transitionDuration: `var(--spring-${name}-duration)`,
                    transitionTimingFunction: `var(--spring-${name})`,
                  }}
                />
              </Row>
            );
          })}
        </ul>
      </section>

      <section
        className="flex flex-col gap-3"
        style={{ "--tone": "var(--tone-blue)" } as CSSProperties}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="type-title">Easings</h2>
          <label className="flex items-center gap-2 type-body">
            Played over
            <select
              value={easeFor}
              onChange={(e) => setEaseFor(e.target.value as DurationName)}
              className="h-11 rounded-[14px] border border-line-strong bg-surface-raised px-3"
            >
              {(Object.keys(durations) as DurationName[]).map((d) => (
                <option key={d} value={d}>
                  {d} ({durations[d]} ms)
                </option>
              ))}
            </select>
          </label>
        </div>
        <ul className="flex flex-col gap-3">
          {(Object.keys(easings) as EasingName[]).map((name) => (
            <Row key={name} name={name} detail={easings[name].slice("cubic-bezier".length)}>
              <Track
                there={at(`easing-${name}`)}
                onFlip={() => flip(`easing-${name}`)}
                style={{
                  transitionDuration: `var(--duration-${easeFor})`,
                  transitionTimingFunction: `var(--easing-${name})`,
                }}
              />
            </Row>
          ))}
        </ul>
      </section>

      <section
        className="flex flex-col gap-3"
        style={{ "--tone": "var(--tone-orange)" } as CSSProperties}
      >
        <h2 className="type-title">Durations</h2>
        <p className="type-body text-ink-muted">With the standard easing.</p>
        <ul className="flex flex-col gap-3">
          {(Object.keys(durations) as DurationName[]).map((name) => (
            <Row key={name} name={name} detail={`${durations[name]} ms`}>
              <Track
                there={at(`duration-${name}`)}
                onFlip={() => flip(`duration-${name}`)}
                style={{
                  transitionDuration: `var(--duration-${name})`,
                  transitionTimingFunction: "var(--easing-standard)",
                }}
              />
            </Row>
          ))}
        </ul>
      </section>
    </main>
  );
}

/** The shared recipes from docs/motion.md, live, so a change to the tokens can be felt on them. */
function Recipes() {
  const detail = useRef<HTMLDialogElement>(null);
  const editor = useRef<HTMLDialogElement>(null);
  const detailMotion = useDialogMotion(detail);
  const editorMotion = useDialogMotion(editor);
  const [cascade, setCascade] = useState(0);

  return (
    <section
      className="flex flex-col gap-3"
      style={{ "--tone": "var(--tone-violet)" } as CSSProperties}
    >
      <h2 className="type-title">Recipes</h2>
      <p className="type-body text-ink-muted">
        What features build on. A dialog grows out of the button that opened it and shrinks back;
        &ldquo;Edit&rdquo; hands it over to a second dialog, which morphs out of the first; a
        cascade brings rows in one after another.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => detail.current?.showModal()}>Open a dialog</Button>
        <Button onClick={() => setCascade((n) => n + 1)}>Replay the cascade</Button>
      </div>
      <ul key={cascade} className="pw-stagger grid grid-cols-2 gap-3 sm:grid-cols-4">
        {["One", "Two", "Three", "Four"].map((label) => (
          <li key={label} className="rounded-[14px] border border-line bg-surface p-4 type-heading">
            {label}
          </li>
        ))}
      </ul>

      <dialog
        ref={detail}
        className="m-auto w-[min(92vw,520px)] rounded-3xl border border-line bg-surface-raised p-0 text-ink shadow-float"
      >
        <div className="pw-stagger flex flex-col gap-4 p-6">
          <h3 className="type-title">A detail</h3>
          <p className="type-body text-ink-muted">
            Opened with showModal(); useDialogMotion grew it out of the button. Press Escape halfway
            through opening to see it turn round.
          </p>
          <div className="h-40 rounded-[14px] bg-tone/15" />
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={detailMotion.close}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                detailMotion.handOff();
                editor.current?.showModal();
              }}
            >
              Edit (hand over)
            </Button>
          </div>
        </div>
      </dialog>

      <dialog
        ref={editor}
        className="m-auto w-[min(92vw,380px)] rounded-3xl border border-line bg-surface-raised p-0 text-ink shadow-float"
      >
        <div className="pw-stagger flex flex-col gap-4 p-6">
          <h3 className="type-title">An editor</h3>
          <p className="type-body text-ink-muted">
            Morphed out of the detail. Closing it goes home to the button that opened the detail.
          </p>
          <Button variant="primary" onClick={editorMotion.close}>
            Done
          </Button>
        </div>
      </dialog>
    </section>
  );
}
