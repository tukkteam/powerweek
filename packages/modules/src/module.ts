import type { z } from "zod";

/**
 * The module contract (version 1).
 *
 * A module owns one part of a person's document: its data shape, the operations that change it
 * and what the assistant needs to know to write those operations from a spoken sentence. The
 * kernel does the rest: it validates, applies, keeps a receipt of every change and composes the
 * assistant prompt. Modules never import each other.
 */
export const CONTRACT_VERSION = 1;

/** Anything that survives a round trip through JSON. Module data and change facts are Json. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** Lowercase slug, 2–32 characters: "agenda", "habits", "my-reading". */
export const MODULE_ID_PATTERN = /^[a-z][a-z0-9-]{1,31}$/;
export type ModuleId = string;

/** Ids the kernel keeps for itself: screen changes and operations that span modules. */
export const RESERVED_IDS: readonly string[] = [
  "app",
  "layout",
  "day",
  "week",
  "module",
  // Every object already has a property by this name.
  "constructor",
];

/** Local operation name inside a module: "add", "exercise.add". */
export const OPERATION_NAME_PATTERN = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)*$/;

export type ChangeKind = "add" | "update" | "remove" | "move";

/** One line of the Change Receipt. User content stays raw; `describe` turns it into a sentence. */
export interface Change {
  kind: ChangeKind;
  /** The module that changed, or "app" when the screen itself changed. */
  module: ModuleId;
  /** Where it happened. Hosts define the keys; in a weekly planner it is a weekday. */
  day?: string;
  toDay?: string;
  /** "week" when the change is not tied to one day; "app" for the screen. */
  scope?: "week" | "app";
  /** What changed, as the person wrote it. */
  label: string;
  /** Module facts that `describe` needs (a time, a slot, a count). */
  data?: Record<string, Json>;
}

/** A change as a module reports it; the kernel adds the module id. */
export type ChangeDraft = Omit<Change, "module">;

/**
 * Why an operation did not apply. A module returns one of the first four; the kernel adds the
 * last two.
 * - `not_found`: it names something that does not exist.
 * - `limit`: a list is full.
 * - `noop`: nothing would change.
 * - `conflict`: it clashes with something already there (a second item with the same name).
 * - `invalid`: its fields did not validate, it threw, or it left data the module's schema rejects.
 * - `unavailable`: the module is unknown here, or its stored data cannot be read by this version.
 */
export type RejectionReason =
  "not_found" | "limit" | "noop" | "conflict" | "invalid" | "unavailable";

export interface Rejection {
  index: number;
  op: string;
  reason: RejectionReason;
}

/** Every module names itself in each language of the host. */
export interface ModuleMessages {
  /** Shown as the module's title. */
  name: string;
  /** One sentence for the module gallery: what it helps with. */
  description: string;
  /**
   * One thing a person can say to it, as they would say it and without quotation marks:
   * "Dentist on Thursday at 1:30 pm". Hosts show it wherever they introduce the module.
   */
  example: string;
}

/** A line of the assistant prompt: the operation's fields and what to say about them. */
export interface PromptExample {
  fields: Record<string, unknown>;
  hint?: string;
}

export interface ApplyContext<Msg> {
  /** A new short id for an item. */
  newId(): string;
  /** The module's strings in the person's language, for default titles. */
  t: Msg;
  /** Report one line for the Change Receipt. */
  change(change: ChangeDraft): void;
}

/**
 * An operation changes the module's data. It is the only way data changes: the assistant writes
 * operations as JSON and the interface sends the same ones for edits made by hand.
 */
export interface OperationSpec<State, Msg, Input> {
  /**
   * The operation's fields, without "op". Be forgiving about shape (a model writes them) and
   * strict about meaning. Parsing must be idempotent: parsing its own output changes nothing.
   */
  input: z.ZodType<Input>;
  /** At least one example; each becomes a line of the assistant prompt. */
  examples: readonly PromptExample[];
  /**
   * Change `state` in place and report what changed with `ctx.change`. Return a reason to skip
   * the operation; the kernel then restores the data as it was. It does the same when the
   * operation throws, reports nothing, or leaves data the module's schema rejects: an operation
   * applies whole or not at all.
   */
  apply(state: State, input: Input, ctx: ApplyContext<Msg>): RejectionReason | void;
}

/** One dated fact: what happened on a real date, as opposed to what the document plans. */
export interface RecordWrite {
  day: string;
  key: string;
  /** Null removes the fact. */
  value: Json | null;
}

export interface RecordContext<Msg> {
  t: Msg;
  /** The fact stored for a day of the current period, if any. */
  get(day: string, key: string): Json | undefined;
  /** Store a fact and report it in the receipt. */
  write(write: RecordWrite, change: ChangeDraft): void;
}

/**
 * A record operation notes something that happened on a date ("today I had the sushi", "three
 * glasses so far"). It never changes the document, so it has no undo.
 */
export interface RecordSpec<State, Msg, Input> {
  input: z.ZodType<Input>;
  examples: readonly PromptExample[];
  /**
   * How this record means its days. By default a day is one of the current period, which may
   * already be behind ("I did it on Monday"). With `upcoming`, a day is the next time it comes,
   * today included ("tomorrow I'll have the lentils"), so on a Sunday "Monday" is tomorrow and
   * not six days ago.
   */
  upcoming?: boolean;
  /** Work out what to store. `state` is read-only here: a record never changes the plan. */
  resolve(state: State, input: Input, ctx: RecordContext<Msg>): RejectionReason | void;
}

export interface AssistantSpec<State> {
  /** What the module holds and how its data is laid out, in a few sentences for the model. */
  about: string;
  /** Rules for this module's operations. The kernel numbers them. */
  rules?: readonly string[];
  /** A long reference text such as a catalogue. Only sent while the module is on screen. */
  reference?: () => string;
  /** What the model sees of the data. Defaults to the data itself. */
  view?(state: State): unknown;
}

/** The erased type of an operation's fields once it sits in a module's list. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyInput = any;

export interface ModuleSpec<State, Msg extends ModuleMessages = ModuleMessages> {
  id: ModuleId;
  /** Version of the data shape. Raise it together with `migrate`. */
  version: number;
  /** Who maintains the module; shown in the gallery. */
  author?: string;
  /** Default colour: a tone name from the host palette. */
  tone: string;
  /** Icon name from the host icon set. */
  icon: string;
  /** Strings per language. Every language must have the same keys. */
  messages: Record<string, Msg>;
  /** The data shape, strict. The kernel never saves data that fails it. */
  schema: z.ZodType<State>;
  /** The data of someone who has not used the module yet. */
  empty(): State;
  /** Bring data written by an older version up to `version`. */
  migrate?(data: unknown, fromVersion: number): unknown;
  operations: Record<string, OperationSpec<State, Msg, AnyInput>>;
  records?: Record<string, RecordSpec<State, Msg, AnyInput>>;
  /**
   * Runs after every operation that touched the data, before the schema checks it: keep lists
   * sorted, drop empty containers.
   */
  normalize?(state: State): void;
  /** One readable line for a change this module reported. */
  describe(change: Change, t: Msg): string;
  assistant: AssistantSpec<State>;
}

// The kernel holds modules of different data types in one list.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyModule = ModuleSpec<any, any>;

/** The data type of a module. */
export type StateOf<M> = M extends ModuleSpec<infer State, infer _Msg> ? State : never;
/** The strings type of a module. */
export type MessagesOf<M> = M extends ModuleSpec<infer _State, infer Msg> ? Msg : never;

/**
 * Typed helpers to write a module's operations and records: they fix the data and strings types
 * once, and infer each operation's fields from its schema.
 *
 *     const { operation, record } = parts<AgendaData, AgendaMessages>();
 */
export function parts<State, Msg extends ModuleMessages = ModuleMessages>() {
  return {
    operation<Schema extends z.ZodType>(
      spec: OperationSpec<State, Msg, z.output<Schema>> & { input: Schema },
    ): OperationSpec<State, Msg, z.output<Schema>> {
      return spec;
    },
    record<Schema extends z.ZodType>(
      spec: RecordSpec<State, Msg, z.output<Schema>> & { input: Schema },
    ): RecordSpec<State, Msg, z.output<Schema>> {
      return spec;
    },
  };
}

/** Declares a module. Returns it unchanged; the point is the type check. */
export function defineModule<State, Msg extends ModuleMessages = ModuleMessages>(
  spec: ModuleSpec<State, Msg>,
): ModuleSpec<State, Msg> {
  return spec;
}

/** What a gallery or a registry lists about a module: plain data, no code. */
export interface ModuleManifest {
  contract: number;
  id: ModuleId;
  version: number;
  author?: string;
  tone: string;
  icon: string;
  names: Record<string, { name: string; description: string; example: string }>;
  operations: string[];
  records: string[];
}

export function manifestOf(module: AnyModule): ModuleManifest {
  return {
    contract: CONTRACT_VERSION,
    id: module.id,
    version: module.version,
    ...(module.author ? { author: module.author } : {}),
    tone: module.tone,
    icon: module.icon,
    names: Object.fromEntries(
      Object.entries(module.messages as Record<string, ModuleMessages>).map(([lang, t]) => [
        lang,
        { name: t.name, description: t.description, example: t.example },
      ]),
    ),
    operations: Object.keys(module.operations).map((name) => `${module.id}.${name}`),
    records: Object.keys(module.records ?? {}).map((name) => `${module.id}.${name}`),
  };
}
