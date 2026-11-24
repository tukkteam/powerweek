"use client";

import { weekLoads } from "@tukkteam/modules/week";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "@/components/app/app-provider";
import { DayBar } from "@/components/app/day-bar";
import { ModuleDesk } from "@/components/app/module-desk";
import { ModuleSlot } from "@/components/app/module-slot";
import { useDayClock } from "@/components/app/use-day-clock";
import { WeekPulse } from "@/components/app/week-pulse";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { shortDate } from "@/lib/format";
import { kernel } from "@/modules";
import { shownModules, summaries } from "@/modules/board";
import { toneStyle } from "@/modules/look";

/**
 * One day, drawn: the Week Pulse to pick a day, the day as a progress bar, then one card per
 * module on screen, in the person's order. The last box is always the outline of the next
 * module: tapping it (or "Arrange") turns the cards into a desk of tiles to add, remove and
 * reorder them.
 */
export function TodayView() {
  const { doc, today, dates, selectedDay, selectDay, listening, thinking, recordsOf, edit } =
    useApp();
  const { lang, dict } = useLocale();
  const [focus, setFocus] = useState<{ module: string; id: string; nonce: number } | null>(null);
  const [arranging, setArranging] = useState(false);

  const shown = useMemo(() => shownModules(doc, lang), [doc, lang]);
  const loads = useMemo(() => weekLoads(kernel, doc), [doc]);
  const { relation, now } = useDayClock(selectedDay);
  const isToday = relation === "today";
  const dateLabel = shortDate(dates[selectedDay], lang);
  const counts = summaries(shown, selectedDay);

  // The desk works on a copy of the screen. When the screen itself changes while it is open
  // (by voice, or on another device), it starts over from the new one, and while a request is
  // still on its way "Done" waits: it can never put back what that change took away.
  const layoutKey = doc.layout.join(" ");

  const arrange = (order: string[] | null) => {
    setArranging(false);
    if (order) void edit([{ op: "layout.set", modules: order }]);
  };

  // Nothing on screen yet: the person chooses what they want to organise.
  if (shown.length === 0)
    return <ModuleDesk key={layoutKey} doc={doc} welcome busy={thinking} onDone={arrange} />;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <p className="type-label text-ink-muted">
            {isToday ? dict.app.todayEyebrow(dateLabel) : dict.app.dayEyebrow(dateLabel)}
          </p>
          {!isToday ? (
            <button
              type="button"
              onClick={() => selectDay(today.dayKey)}
              className="type-label h-11 rounded-full px-3 text-volt-ink hover:bg-surface-raised"
            >
              {dict.app.backToToday}
            </button>
          ) : null}
        </div>
        <h1 className="type-display">{dict.days.long[selectedDay]}</h1>
        {counts.length === 0 ? (
          <p className="type-caption text-ink-muted">{dict.week.freeDay}</p>
        ) : (
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            {counts.map((count) => (
              <span
                key={count.id}
                style={toneStyle(count.tone)}
                className="type-caption flex items-center gap-1.5 text-ink-muted"
              >
                <span className="size-2 rounded-full bg-tone" aria-hidden="true" />
                {count.text}
              </span>
            ))}
          </p>
        )}
      </section>

      {/*
        Phones and tablets: the Week Pulse stands above the day. Desktop: it lies down in a column
        beside the Day Bar and both share one height, so the region stays balanced however tall
        the day's timeline grows, and the days never move when you switch between them.
      */}
      <div className="grid items-start gap-6 lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:items-stretch lg:gap-4">
        <section className="lg:flex lg:flex-col lg:rounded-[14px] lg:border lg:border-line lg:bg-surface lg:p-3">
          <p
            aria-hidden="true"
            className="type-label hidden px-2.5 pt-1.5 pb-3 text-ink-muted lg:block"
          >
            {dict.app.pulseLabel}
          </p>
          <WeekPulse
            className="lg:flex-1"
            loads={loads}
            todayKey={today.dayKey}
            selected={selectedDay}
            onSelect={selectDay}
            dates={dates}
            listening={listening}
          />
        </section>
        <DayBar
          shown={shown}
          day={selectedDay}
          relation={relation}
          now={now}
          record={(module, key) => recordsOf(module).get(selectedDay, key)}
          onOpen={(module, id) =>
            setFocus((previous) => ({ module, id, nonce: (previous?.nonce ?? 0) + 1 }))
          }
        />
      </div>

      {arranging ? (
        <ModuleDesk key={layoutKey} doc={doc} busy={thinking} onDone={arrange} />
      ) : (
        <section aria-label={dict.modules.title} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="type-label text-ink-muted">{dict.modules.title}</h2>
            <Button variant="ghost" onClick={() => setArranging(true)}>
              {dict.modules.arrange}
            </Button>
          </div>
          <div className="grid grid-flow-dense gap-4 lg:grid-cols-2">
            {shown.map((entry) => (
              <ModuleSlot
                key={entry.module.id}
                entry={entry}
                day={selectedDay}
                relation={relation}
                now={now}
                focus={focus?.module === entry.module.id ? focus : null}
              />
            ))}
            <button
              type="button"
              onClick={() => setArranging(true)}
              className="group flex min-h-32 flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-line text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
            >
              <span className="flex size-10 items-center justify-center rounded-full border border-dashed border-current">
                <Plus size={20} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="type-heading">{dict.modules.add}</span>
              <span aria-hidden="true" className="type-label tracking-[0.4em]">
                ···
              </span>
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
