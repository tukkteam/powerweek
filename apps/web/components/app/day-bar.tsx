"use client";

import type { Json } from "@tukkteam/modules";
import {
  dayWindow,
  fromMinutes,
  position,
  spanProgress,
  type DayKey,
  type DayRelation,
} from "@tukkteam/modules/week";
import { useLocale } from "@/components/i18n/locale-provider";
import { formatDuration } from "@/lib/format";
import { useTween } from "@/lib/use-tween";
import { dayTimeline, type DayTimeline, type Shown } from "@/modules/board";
import { ModuleIcon, toneStyle } from "@/modules/look";

const RAIL_TOP = 22;
const RAIL_HEIGHT = 10;
const LANE_TOP = RAIL_TOP + RAIL_HEIGHT + 12;
const LANE_HEIGHT = 30;
const LANE_GAP = 6;
const MARKER_SIZE = 24;
const LABELS = 20;

const pct = (value: number) => `${(value * 100).toFixed(3)}%`;

interface DayBarProps {
  /** The modules on screen; each may place things on the day. */
  shown: readonly Shown[];
  day: DayKey;
  relation: DayRelation;
  /** Minute of the day when `relation` is today; null otherwise or before the clock starts. */
  now: number | null;
  /** A dated fact of a module for this day, if any. */
  record: (module: string, key: string) => Json | undefined;
  /** Something on the timeline was tapped: its module and the id the module gave it. */
  onOpen: (module: string, id: string) => void;
  className?: string;
}

/**
 * The day as one progress bar: a rail fills from morning to midnight, and whatever the modules
 * on screen have at a time of day sits on it, each in its module's colour. Things that last are
 * blocks that fill as their own time passes; things at a moment are round markers. The day
 * reads at a glance: done, now, next.
 */
export function DayBar({ shown, day, relation, now, record, onOpen, className = "" }: DayBarProps) {
  const { lang, dict } = useLocale();
  const timeline = dayTimeline(shown, day, lang, record);
  const range = dayWindow(timeline.spans);

  const progress =
    relation === "past" ? 1 : relation === "future" || now === null ? 0 : position(now, range);
  const live = relation === "today" && now !== null;
  const shownPercent = useTween(progress * 100);
  const status =
    relation === "past" || (live && now! >= range.end)
      ? dict.day.finished
      : relation === "future"
        ? dict.day.ahead
        : live
          ? dict.day.remaining(formatDuration(range.end - Math.max(now!, range.start)))
          : "";

  const markersTop = LANE_TOP + timeline.spanRows * (LANE_HEIGHT + LANE_GAP);
  const bodyBottom = markersTop + timeline.markerRows * (MARKER_SIZE + LANE_GAP);
  const empty = timeline.spans.length === 0 && timeline.markers.length === 0;
  const height = (empty ? LANE_TOP + 8 : bodyBottom + 4) + LABELS;
  const legend = shown.filter((entry) => entry.readable && entry.module.week?.timeline);

  const ticks: number[] = [];
  for (let t = Math.ceil(range.start / 180) * 180; t <= range.end; t += 180) ticks.push(t);

  return (
    <section
      aria-label={dict.day.title}
      className={`flex flex-col rounded-[14px] border border-line bg-surface p-4 sm:p-5 ${className}`}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex items-end gap-3">
          <p className="font-display stretch-wide text-[2.75rem] leading-[0.85] font-black tabular-nums">
            {relation === "today" && now === null ? "––" : Math.round(shownPercent)}
            <span className="text-[1.25rem] text-ink-muted">%</span>
          </p>
          <p className="flex flex-col pb-0.5">
            <span className="type-label text-ink-muted">{dict.day.ofDay}</span>
            <span className="type-caption">{status}</span>
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-hidden="true">
          {legend.map((entry) => (
            <li
              key={entry.module.id}
              className="type-label flex items-center gap-1.5 text-ink-muted"
              style={toneStyle(entry.module.tone)}
            >
              <span className="size-2 rounded-full bg-tone" />
              {entry.t.name}
            </li>
          ))}
        </ul>
      </div>

      <div className="pw-track relative mt-4 flex-1" style={{ minHeight: height }}>
        {ticks.map((t) => (
          <span
            key={t}
            aria-hidden="true"
            className="pw-slide absolute w-px bg-line"
            style={{ left: pct(position(t, range)), top: RAIL_TOP, bottom: LABELS }}
          />
        ))}

        <div
          role="progressbar"
          aria-label={dict.day.title}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-valuetext={status || undefined}
          className="absolute inset-x-0 overflow-hidden rounded-full bg-ink/10"
          style={{ top: RAIL_TOP, height: RAIL_HEIGHT }}
        >
          <span
            className="pw-fill absolute inset-y-0 left-0 rounded-full bg-volt-ink"
            style={{ width: pct(progress) }}
          />
        </div>

        {live && progress > 0 && progress < 1 ? (
          <span
            aria-hidden="true"
            className="absolute left-0 bg-ink/[0.04]"
            style={{ width: pct(progress), top: LANE_TOP - 6, bottom: LABELS }}
          />
        ) : null}

        {timeline.spans.map((span, index) => (
          <SpanBlock
            key={`${span.module}-${span.id}`}
            span={span}
            delay={index * 50}
            top={LANE_TOP + span.row * (LANE_HEIGHT + LANE_GAP)}
            range={range}
            progress={spanProgress(span, now, relation).progress}
            label={dict.day.spanLabel(
              span.title,
              span.open
                ? fromMinutes(span.start)
                : `${fromMinutes(span.start)}–${fromMinutes(span.end)}`,
            )}
            onClick={() => onOpen(span.module, span.id)}
          />
        ))}

        {timeline.markers.map((marker, index) => {
          const passed =
            !marker.pending &&
            (relation === "past" ||
              (relation === "today" && now !== null && now >= marker.at + 30));
          return (
            <button
              key={`${marker.module}-${marker.id}`}
              type="button"
              onClick={() => onOpen(marker.module, marker.id)}
              aria-label={dict.day.spanLabel(marker.title, fromMinutes(marker.at))}
              title={marker.title}
              className={`pw-pop pw-slide absolute flex -translate-x-1/2 items-center justify-center rounded-full hover:scale-110 ${
                passed
                  ? "bg-tone text-bg"
                  : marker.pending
                    ? "border-2 border-dashed border-tone/70 bg-surface text-tone"
                    : "border-2 border-tone bg-surface text-tone"
              }`}
              style={{
                ...toneStyle(marker.tone),
                left: pct(position(marker.at, range)),
                top: markersTop + marker.row * (MARKER_SIZE + LANE_GAP),
                width: MARKER_SIZE,
                height: MARKER_SIZE,
                animationDelay: `${120 + index * 60}ms`,
              }}
            >
              <ModuleIcon name={marker.glyph} size={12} strokeWidth={2.25} />
            </button>
          );
        })}

        {empty ? (
          <p
            className="pw-fade type-caption absolute left-0 z-10 -ml-1.5 max-w-full rounded-[6px] bg-surface px-1.5 py-0.5 text-ink-muted"
            style={{ top: LANE_TOP - 4 }}
          >
            {dict.day.nothingTimed}
          </p>
        ) : null}

        {live ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute flex flex-col items-center"
            style={{ left: pct(progress), top: 0, bottom: LABELS, transform: "translateX(-50%)" }}
          >
            <span className="type-numeric rounded-full bg-volt px-1.5 py-0.5 text-[0.6875rem] text-on-volt">
              {fromMinutes(now!)}
            </span>
            <span className="mt-[3px] size-3 shrink-0 rounded-full border-2 border-surface bg-volt-ink" />
            <span className="w-0.5 flex-1 rounded-full bg-ink/60" />
          </span>
        ) : null}

        <div aria-hidden="true" className="absolute inset-x-0 bottom-0" style={{ height: LABELS }}>
          {ticks.map((t, i) => (
            <span
              key={t}
              className={`pw-slide type-numeric absolute bottom-0 text-[0.6875rem] text-ink-muted ${
                i === 0 ? "" : i === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2"
              } ${i % 2 === 1 ? "max-sm:hidden" : ""}`}
              style={{ left: pct(position(t, range)) }}
            >
              {fromMinutes(t).slice(0, 2)}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function SpanBlock({
  span,
  top,
  range,
  progress,
  label,
  onClick,
  delay = 0,
}: {
  span: DayTimeline["spans"][number];
  delay?: number;
  top: number;
  range: { start: number; end: number };
  progress: number;
  label: string;
  onClick: () => void;
}) {
  const left = position(span.start, range);
  const width = Math.max(0, position(span.end, range) - left);
  const iconed = Boolean(span.icon);
  const text = (
    <>
      {iconed ? (
        <ModuleIcon name={span.glyph} size={13} strokeWidth={2.25} className="shrink-0" />
      ) : null}
      <span className={`truncate ${iconed ? "@max-[4.5rem]:hidden" : ""}`}>{span.title}</span>
      <span className="font-mono text-[0.6875rem] font-medium opacity-80 @max-[9rem]:hidden">
        {fromMinutes(span.start)}
      </span>
    </>
  );
  const narrow = iconed ? "@max-[4.5rem]:justify-center @max-[4.5rem]:px-0" : "@max-[3rem]:hidden";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`pw-reveal pw-slide @container absolute overflow-hidden rounded-[8px] border border-tone/30 bg-tone/15 text-left hover:brightness-110 ${
        span.open ? "border-dashed" : ""
      }`}
      style={{
        ...toneStyle(span.tone),
        left: pct(left),
        width: `max(8px, calc(${pct(width)} - 2px))`,
        top,
        height: LANE_HEIGHT,
        animationDelay: `${delay}ms`,
      }}
    >
      <span
        className="pw-fill absolute inset-y-0 left-0 bg-tone"
        style={{ width: pct(progress) }}
      />
      <span
        className={`relative flex h-full items-center gap-1.5 px-2 text-[0.75rem] font-semibold whitespace-nowrap text-ink ${narrow}`}
      >
        {text}
      </span>
      <span
        aria-hidden="true"
        className={`absolute inset-0 flex items-center gap-1.5 px-2 text-[0.75rem] font-semibold whitespace-nowrap text-bg ${narrow}`}
        style={{ clipPath: `inset(0 ${(100 - progress * 100).toFixed(3)}% 0 0)` }}
      >
        {text}
      </span>
    </button>
  );
}
