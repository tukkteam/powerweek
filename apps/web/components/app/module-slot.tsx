"use client";

import type { DayKey, DayRelation } from "@tukkteam/modules/week";
import { useEffect, useRef } from "react";
import { useApp } from "@/components/app/app-provider";
import { ModuleBoundary } from "@/components/app/module-boundary";
import { ModuleCard } from "@/components/app/module-card";
import { useLocale } from "@/components/i18n/locale-provider";
import type { Shown } from "@/modules/board";
import { toneStyle } from "@/modules/look";
import { viewsOf } from "@/modules/views";

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
  const { recordsOf, edit, version, today } = useApp();
  const { lang, dict } = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const { module, t } = entry;
  const views = viewsOf(module.id);

  // Something of this module was tapped on the day's timeline: bring its card into view. Only
  // for a new tap: a card that comes back on screen does not scroll for the last one again.
  const nonce = focus?.nonce;
  const handled = useRef(nonce);
  useEffect(() => {
    if (!nonce || handled.current === nonce) return;
    handled.current = nonce;
    ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
            today={today.dayKey}
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
