import type { Json, ModuleMessages, Operation } from "@tukkteam/modules";
import type { DayKey, DayRelation } from "@tukkteam/modules/week";
import type { ComponentType } from "react";
import type { Locale } from "@/lib/i18n/config";

/**
 * What PowerWeek gives a module's views, and what it expects back. Views are plain React
 * components: everything they may use arrives as props, so a module never reaches into the app.
 */

/** The dated facts of one module for the week on screen: ticks, picks, counts. */
export interface ModuleRecords {
  get(day: DayKey, key: string): Json | undefined;
  /** Store a fact for that day's date; null removes it. Saved at once, no receipt. */
  set(day: DayKey, key: string, value: Json | null): void;
}

export interface ViewProps<State, Msg extends ModuleMessages = ModuleMessages> {
  /** The module's data. Never change it in place: send operations. */
  data: State;
  /** The module's own strings in the person's language. */
  t: Msg;
  lang: Locale;
  /** The day being shown. */
  day: DayKey;
  records: ModuleRecords;
}

export interface CardProps<State, Msg extends ModuleMessages = ModuleMessages> extends ViewProps<
  State,
  Msg
> {
  /** Whether `day` is before, on or after today. */
  relation: DayRelation;
  /** The minute of the day when `day` is today; null otherwise. */
  now: number | null;
  /**
   * Send operations, the same ones the assistant writes. Resolves true once they are saved;
   * the receipt and undo are handled outside the module.
   */
  dispatch(operations: Operation[]): Promise<boolean>;
  /**
   * Something of this module was tapped on the day's timeline; `nonce` changes on every tap.
   * The card is scrolled into view for you. Read it with `useTapped` to open an editor.
   */
  focus: { id: string; nonce: number } | null;
}

export interface ModuleViews<State, Msg extends ModuleMessages = ModuleMessages> {
  /** The module on the Today screen: the whole card, with its own editors. */
  Card: ComponentType<CardProps<State, Msg>>;
  /** Columns the card takes on wide screens. */
  span?: 1 | 2;
  /** One day of the module in the week board. Left out, the module has no column there. */
  WeekCell?: ComponentType<ViewProps<State, Msg>>;
  /** How wide its column is in the week board, relative to the others. */
  weekWeight?: number;
  /**
   * Whether the module holds anything on a day. Defaults to "its load is above zero"; a module
   * whose content does not count as load (a note) says so here.
   */
  hasDay?(data: State, day: DayKey): boolean;
  /** Everything the module holds on one day, shown on hover or long press in the week board. */
  Peek?: ComponentType<ViewProps<State, Msg>>;
}

// The registry holds views of modules with different data types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyViews = ModuleViews<any, any>;
