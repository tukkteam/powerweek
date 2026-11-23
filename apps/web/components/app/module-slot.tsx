"use client";

import type { DayKey, DayRelation } from "@tukkteam/modules/week";
import { Component, useEffect, useRef, type ReactNode } from "react";
import { useApp } from "@/components/app/app-provider";
import { ModuleCard } from "@/components/app/module-card";
import { useLocale } from "@/components/i18n/locale-provider";
import type { Shown } from "@/modules/board";
import { toneStyle } from "@/modules/look";
import { VIEWS } from "@/modules/views";

/**
 * The place a module takes on the Today screen. It gives the module its colour and everything
 * its card may use, and it keeps the rest of the screen safe from it: a module whose stored
 * data cannot be read, or whose card throws, shows a notice in its place and nothing else stops.
 */
export function ModuleSlot({
  entry,
  day,
  relation,
  now,
  focus,
}: {
  entry: Shown;
  day: DayKey;
  relation: DayRelation;
  now: number | null;
  focus: { id: string; nonce: number } | null;
}) {
  const { recordsOf, edit, version } = useApp();
  const { lang, dict } = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const { module, t } = entry;
  const views = VIEWS[module.id];

  // Something of this module was tapped on the day's timeline: bring its card into view.
  const nonce = focus?.nonce;
  useEffect(() => {
    if (nonce) ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [nonce]);

  if (!views) return null;
  const Card = views.Card;

  return (
    <div
      ref={ref}
      id={`module-${module.id}`}
      style={toneStyle(module.tone)}
      className={`min-w-0 scroll-mt-24 ${views.span === 2 ? "lg:col-span-2" : ""}`}
    >
      {entry.readable ? (
        <ModuleBoundary
          resetKey={version}
          fallback={
            <Notice title={dict.modules.failedTitle(t.name)} body={dict.modules.failedBody} />
          }
        >
          <Card
            data={entry.state}
            t={t}
            lang={lang}
            day={day}
            relation={relation}
            now={now}
            records={recordsOf(module.id)}
            dispatch={edit}
            focus={focus}
          />
        </ModuleBoundary>
      ) : (
        <Notice title={dict.modules.unreadableTitle(t.name)} body={dict.modules.unreadableBody} />
      )}
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <ModuleCard icon="triangle-alert" title={title}>
      <p className="type-body py-2 text-ink-muted">{body}</p>
    </ModuleCard>
  );
}

/** Catches a module card that throws while rendering. A new plan version gives it another go. */
class ModuleBoundary extends Component<
  { resetKey: number; fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("A module card failed to render", error);
  }

  componentDidUpdate(previous: { resetKey: number }) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey)
      this.setState({ failed: false });
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
