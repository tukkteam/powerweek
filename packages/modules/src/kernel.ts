import type { z } from "zod";
import {
  DocSchema,
  MAX_LAYOUT,
  ModuleEntrySchema,
  emptyDoc,
  type Doc,
  type ModuleEntry,
} from "./doc";
import { sameText } from "./fields";
import { newId as defaultNewId } from "./ids";
import { layoutOperations } from "./layout";
import {
  MODULE_ID_PATTERN,
  OPERATION_NAME_PATTERN,
  RESERVED_IDS,
  type AnyInput,
  type AnyModule,
  type ApplyContext,
  type Change,
  type Json,
  type ModuleId,
  type ModuleMessages,
  type OperationSpec,
  type PromptExample,
  type RecordSpec,
  type RecordWrite,
  type Rejection,
  type RejectionReason,
  type StateOf,
} from "./module";

/** An operation as it travels: its full name ("agenda.add") and its fields. */
export type Operation = { op: string } & Record<string, unknown>;

/** What an operation that spans modules can reach. */
export interface SystemContext<M extends AnyModule> {
  modules: readonly M[];
  lang: string;
  /** Find a module by its id or by its name in any language ("Comidas", "meals"). */
  find(reference: string): M | undefined;
  /** Report a change. */
  change(change: Change): void;
  /**
   * A module's data, ready to change, with the context its hooks expect. Null when the module
   * is unknown or this version cannot read what it stored.
   */
  open(id: ModuleId): { module: M; state: unknown; ctx: ApplyContext<unknown> } | null;
}

/**
 * An operation the kernel or the host provides: it changes the screen or several modules. It may
 * reorder `doc.layout` directly; module data is only reached through `ctx.open`.
 */
export interface SystemOperationSpec<M extends AnyModule, Input> {
  input: z.ZodType<Input>;
  examples: readonly PromptExample[];
  apply(doc: Doc, input: Input, ctx: SystemContext<M>): RejectionReason | void;
}

export interface KernelConfig<M extends AnyModule> {
  modules: readonly M[];
  /** Languages every module must speak. The first one is the fallback. */
  locales: readonly string[];
  /** Operations that span modules, by full name ("day.clear"). Layout operations are built in. */
  system?: Record<string, SystemOperationSpec<M, AnyInput>>;
  /** Other spellings of operation names, mapped to full names. */
  aliases?: Record<string, string>;
  /** Fix the harmless mistakes models make in an operation's fields before validation. */
  normalise?(fields: Record<string, unknown>): Record<string, unknown>;
  /** Turn a document from before the envelope into one, or return null to start empty. */
  upgrade?(raw: unknown): Doc | null;
  /** At most this many operations are read from one model answer. */
  maxOperations?: number;
}

export interface ApplyOptions {
  /** Language for default titles written into the data. */
  lang?: string;
  newId?: () => string;
}

export interface ApplyResult {
  /** The new document, or the same object when nothing changed. */
  doc: Doc;
  changes: Change[];
  rejected: Rejection[];
}

export interface ParsedOperations {
  /** Operations that change the document, validated and normalised. */
  operations: Operation[];
  /** Operations that note a dated fact; they do not change the document. */
  records: Operation[];
  /** How many operations did not validate and were left out. */
  dropped: number;
}

export interface RecordsOptions {
  lang?: string;
  /** The fact currently stored for a module, a day and a key. */
  get(module: ModuleId, day: string, key: string): Json | undefined;
}

export interface RecordsResult {
  writes: (RecordWrite & { module: ModuleId })[];
  changes: Change[];
  rejected: Rejection[];
}

export type OperationTarget<M extends AnyModule> =
  | { kind: "operation"; name: string; module: M; spec: OperationSpec<unknown, unknown, AnyInput> }
  | { kind: "record"; name: string; module: M; spec: RecordSpec<unknown, unknown, AnyInput> }
  | { kind: "system"; name: string; spec: SystemOperationSpec<M, AnyInput> };

export interface Kernel<M extends AnyModule> {
  readonly modules: readonly M[];
  readonly locales: readonly string[];
  readonly maxOperations: number;
  get(id: ModuleId): M | undefined;
  /** Find a module by id or by its name in any language. */
  find(reference: string): M | undefined;
  /** Every operation name with what it belongs to, in prompt order. */
  targets(): readonly OperationTarget<M>[];
  /** A module's strings in a language, falling back to the first locale. */
  messages<T extends M>(module: T, lang?: string): T["messages"][string];
  /** A document nobody has used yet. */
  empty(layout?: readonly ModuleId[]): Doc;
  /** Read stored JSON: checks the envelope, upgrades old documents and migrates module data. */
  read(raw: unknown): Doc;
  /** Modules whose stored data this version cannot read. Their data is kept and never written. */
  unreadable(doc: Doc): ReadonlySet<ModuleId>;
  /** A module's data. Returns its empty data when it has none, or when it cannot be read. */
  state<T extends M>(doc: Doc, module: T): StateOf<T>;
  /** Modules on screen, in order, skipping ids this build does not know. */
  onScreen(doc: Doc): M[];
  /** Validate raw operations one by one, so a bad one never discards the good ones. */
  parse(raw: readonly unknown[]): ParsedOperations;
  /** Apply operations. Pure: never changes `doc`. */
  apply(doc: Doc, operations: readonly Operation[], options?: ApplyOptions): ApplyResult;
  /** Work out the dated facts a list of record operations asks to store. */
  resolveRecords(doc: Doc, records: readonly Operation[], options: RecordsOptions): RecordsResult;
  /** One readable line for a change, in the given language. */
  describe(change: Change, lang?: string): string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Keep what can be kept of a document whose envelope is damaged. */
function salvage(raw: unknown): Doc | null {
  if (!isObject(raw) || raw.schemaVersion !== 2) return null;
  const doc = emptyDoc();
  if (isObject(raw.modules)) {
    for (const [id, entry] of Object.entries(raw.modules)) {
      const parsed = ModuleEntrySchema.safeParse(entry);
      if (MODULE_ID_PATTERN.test(id) && parsed.success) doc.modules[id] = parsed.data;
    }
  }
  if (Array.isArray(raw.layout)) {
    for (const id of raw.layout) {
      if (typeof id === "string" && MODULE_ID_PATTERN.test(id) && !doc.layout.includes(id))
        doc.layout.push(id);
    }
  }
  doc.layout = doc.layout.slice(0, MAX_LAYOUT);
  return doc;
}

/**
 * The kernel binds a set of modules into one document: it reads and upgrades stored JSON, routes
 * each operation to its module, keeps the receipt, and refuses to save data a module rejects.
 */
export function createKernel<M extends AnyModule>(config: KernelConfig<M>): Kernel<M> {
  const { modules, locales } = config;
  const maxOperations = config.maxOperations ?? 60;
  const fallback = locales[0];
  if (!fallback) throw new Error("A kernel needs at least one locale");

  const byId = new Map<ModuleId, M>();
  const targetList: OperationTarget<M>[] = [];
  const targetByName = new Map<string, OperationTarget<M>>();
  const addTarget = (target: OperationTarget<M>) => {
    if (targetByName.has(target.name)) throw new Error(`Duplicate operation "${target.name}"`);
    targetByName.set(target.name, target);
    targetList.push(target);
  };

  for (const module of modules) {
    if (!MODULE_ID_PATTERN.test(module.id)) throw new Error(`Invalid module id "${module.id}"`);
    if (RESERVED_IDS.includes(module.id)) throw new Error(`"${module.id}" is a reserved id`);
    if (byId.has(module.id)) throw new Error(`Duplicate module "${module.id}"`);
    for (const locale of locales) {
      if (!module.messages[locale])
        throw new Error(`Module "${module.id}" has no strings for "${locale}"`);
    }
    byId.set(module.id, module);
    for (const [name, spec] of Object.entries(module.operations)) {
      if (!OPERATION_NAME_PATTERN.test(name))
        throw new Error(`Invalid operation name "${module.id}.${name}"`);
      addTarget({ kind: "operation", name: `${module.id}.${name}`, module, spec });
    }
    for (const [name, spec] of Object.entries(module.records ?? {})) {
      if (!OPERATION_NAME_PATTERN.test(name))
        throw new Error(`Invalid record name "${module.id}.${name}"`);
      addTarget({ kind: "record", name: `${module.id}.${name}`, module, spec });
    }
  }
  const system = { ...layoutOperations<M>(), ...config.system };
  for (const [name, spec] of Object.entries(system)) addTarget({ kind: "system", name, spec });

  const empties = new Map<ModuleId, unknown>();
  const emptyOf = (module: M): unknown => {
    if (!empties.has(module.id)) empties.set(module.id, module.empty());
    return empties.get(module.id);
  };

  const messages = <T extends M>(module: T, lang?: string): T["messages"][string] =>
    module.messages[lang ?? fallback] ?? module.messages[fallback];

  const find = (reference: string): M | undefined => {
    const wanted = reference.trim();
    const exact = byId.get(wanted.toLowerCase());
    if (exact) return exact;
    return modules.find((module) =>
      Object.values(module.messages as Record<string, ModuleMessages>).some((t) =>
        sameText(t.name, wanted),
      ),
    );
  };

  /** The full operation name behind whatever the model or an old client wrote. */
  const canonical = (op: string): string => {
    const name = op.trim().toLowerCase().replaceAll("_", ".");
    return config.aliases?.[name] ?? name;
  };

  // Documents are never changed in place, so what we learn about one stays true for it.
  const unreadableOf = new WeakMap<Doc, ReadonlySet<ModuleId>>();
  const unreadable = (doc: Doc): ReadonlySet<ModuleId> => {
    const known = unreadableOf.get(doc);
    if (known) return known;
    const broken = new Set<ModuleId>();
    for (const module of modules) {
      const entry = doc.modules[module.id];
      if (!entry) continue;
      if (entry.v !== module.version || !module.schema.safeParse(entry.data).success)
        broken.add(module.id);
    }
    unreadableOf.set(doc, broken);
    return broken;
  };

  const read = (raw: unknown): Doc => {
    const parsed = DocSchema.safeParse(raw);
    const doc: Doc = parsed.success
      ? (parsed.data as Doc)
      : (config.upgrade?.(raw) ?? salvage(raw) ?? emptyDoc());
    for (const module of modules) {
      const entry = doc.modules[module.id];
      if (!entry || entry.v >= module.version || !module.migrate) continue;
      try {
        const data = module.migrate(structuredClone(entry.data), entry.v);
        if (isObject(data)) doc.modules[module.id] = { v: module.version, data };
      } catch {
        // Left as written: the module shows as unreadable and its data is kept untouched.
      }
    }
    return doc;
  };

  const state = <T extends M>(doc: Doc, module: T): StateOf<T> => {
    const entry = doc.modules[module.id];
    if (!entry || unreadable(doc).has(module.id)) return emptyOf(module) as StateOf<T>;
    return entry.data as StateOf<T>;
  };

  const onScreen = (doc: Doc): M[] =>
    doc.layout.map((id) => byId.get(id)).filter((module): module is M => module !== undefined);

  /** Name, target and validated fields of one operation, however loosely it was written. */
  const check = (
    operation: Record<string, unknown>,
  ): { name: string; target?: OperationTarget<M>; input?: unknown } => {
    const name = canonical(String(operation.op));
    const target = targetByName.get(name);
    if (!target) return { name };
    const { op: _op, ...rest } = operation;
    const input = target.spec.input.safeParse(config.normalise ? config.normalise(rest) : rest);
    return input.success ? { name, target, input: input.data } : { name, target };
  };

  const parse = (raw: readonly unknown[]): ParsedOperations => {
    const operations: Operation[] = [];
    const records: Operation[] = [];
    let dropped = 0;
    for (const item of raw.slice(0, maxOperations)) {
      if (!isObject(item) || typeof item.op !== "string") {
        dropped += 1;
        continue;
      }
      const { name, target, input } = check(item);
      if (!target || !isObject(input)) {
        dropped += 1;
        continue;
      }
      const operation: Operation = { op: name, ...input };
      (target.kind === "record" ? records : operations).push(operation);
    }
    return { operations, records, dropped };
  };

  const apply = (
    doc: Doc,
    operations: readonly Operation[],
    options: ApplyOptions = {},
  ): ApplyResult => {
    const lang = options.lang ?? fallback;
    const makeId = options.newId ?? defaultNewId;
    const broken = unreadable(doc);
    const next: Doc = structuredClone(doc);
    const log: { index: number; module: ModuleId; change: Change }[] = [];
    const rejected: Rejection[] = [];
    const touched = new Set<ModuleId>();
    const shown = new Set<ModuleId>();

    /** A module that just changed belongs on screen. */
    const show = (id: ModuleId, emitted: Change[]) => {
      if (next.layout.includes(id) || next.layout.length >= MAX_LAYOUT) return;
      next.layout.push(id);
      shown.add(id);
      emitted.unshift({ kind: "add", module: "app", scope: "app", label: id });
    };

    const open = (
      id: ModuleId,
      emitted: Change[],
      opened: Map<ModuleId, ModuleEntry | undefined>,
    ) => {
      const module = byId.get(id);
      if (!module || broken.has(id)) return null;
      // Keep the entry as it was before this operation, to put it back if the operation fails.
      if (!opened.has(id)) {
        const before = next.modules[id];
        opened.set(id, before ? structuredClone(before) : undefined);
      }
      const entry: ModuleEntry = (next.modules[id] ??= {
        v: module.version,
        data: module.empty() as Record<string, unknown>,
      });
      const ctx: ApplyContext<unknown> = {
        newId: makeId,
        t: messages(module, lang),
        change: (change) => emitted.push({ ...change, module: id }),
      };
      return { module, state: entry.data as unknown, ctx };
    };

    operations.forEach((operation, index) => {
      const { name, target, input } = check(operation);
      const reject = (reason: RejectionReason) => rejected.push({ index, op: name, reason });
      if (!target || target.kind === "record") return reject("unavailable");
      if (input === undefined) return reject("invalid");

      const emitted: Change[] = [];
      const opened = new Map<ModuleId, ModuleEntry | undefined>();
      const layoutBefore = [...next.layout];
      let reason: RejectionReason | void;
      try {
        if (target.kind === "system") {
          reason = target.spec.apply(next, input, {
            modules,
            lang,
            find,
            change: (change) => emitted.push(change),
            open: (id) => open(id, emitted, opened),
          });
        } else {
          const slot = open(target.module.id, emitted, opened);
          reason = slot ? target.spec.apply(slot.state, input, slot.ctx) : "unavailable";
        }
      } catch {
        reason = "invalid";
      }
      // Nothing changes without a line in the receipt.
      if (!reason && emitted.length === 0) reason = "noop";
      if (reason) {
        next.layout = layoutBefore;
        for (const [id, before] of opened) {
          if (before) next.modules[id] = before;
          else delete next.modules[id];
        }
        return reject(reason);
      }
      for (const id of opened.keys()) touched.add(id);
      if (target.kind === "operation") show(target.module.id, emitted);
      for (const change of emitted) log.push({ index, module: change.module, change });
    });

    // A module has the last word on its own data: anything it does not accept is undone.
    for (const id of touched) {
      const module = byId.get(id);
      const entry = next.modules[id];
      if (!module || !entry) continue;
      let valid = false;
      try {
        module.normalize?.(entry.data);
        const checked = module.schema.safeParse(entry.data);
        if (checked.success && isObject(checked.data)) {
          next.modules[id] = { v: module.version, data: checked.data };
          valid = true;
        }
      } catch {
        valid = false;
      }
      if (valid) continue;
      const original = doc.modules[id];
      if (original) next.modules[id] = structuredClone(original);
      else delete next.modules[id];
      if (shown.has(id)) next.layout = next.layout.filter((other) => other !== id);
      const undone = new Set<number>();
      for (let i = log.length - 1; i >= 0; i -= 1) {
        const line = log[i]!;
        const ownScreenLine = line.module === "app" && line.change.label === id && shown.has(id);
        if (line.module !== id && !ownScreenLine) continue;
        undone.add(line.index);
        log.splice(i, 1);
      }
      for (const index of undone) {
        const name = canonical(String(operations[index]?.op ?? ""));
        rejected.push({ index, op: name, reason: "invalid" });
      }
    }

    rejected.sort((a, b) => a.index - b.index);
    const changes = log.map((line) => line.change);
    if (changes.length === 0) return { doc, changes, rejected };
    unreadableOf.set(next, broken);
    return { doc: next, changes, rejected };
  };

  const resolveRecords = (
    doc: Doc,
    records: readonly Operation[],
    options: RecordsOptions,
  ): RecordsResult => {
    const lang = options.lang ?? fallback;
    const writes: (RecordWrite & { module: ModuleId })[] = [];
    const changes: Change[] = [];
    const rejected: Rejection[] = [];
    // Later operations in the same request see what earlier ones stored.
    const pending = new Map<string, Json | null>();
    const slot = (module: ModuleId, day: string, key: string) => `${module}|${day}|${key}`;

    records.forEach((operation, index) => {
      const { name, target, input } = check(operation);
      const reject = (reason: RejectionReason) => rejected.push({ index, op: name, reason });
      if (!target || target.kind !== "record") return reject("unavailable");
      const module = target.module;
      if (unreadable(doc).has(module.id)) return reject("unavailable");
      if (input === undefined) return reject("invalid");

      const ownWrites: (RecordWrite & { module: ModuleId })[] = [];
      const ownChanges: Change[] = [];
      let reason: RejectionReason | void;
      try {
        reason = target.spec.resolve(state(doc, module), input, {
          t: messages(module, lang),
          get: (day, key) => {
            const id = slot(module.id, day, key);
            if (pending.has(id)) return pending.get(id) ?? undefined;
            return options.get(module.id, day, key);
          },
          write: (write, change) => {
            ownWrites.push({ ...write, module: module.id });
            ownChanges.push({ ...change, module: module.id });
          },
        });
      } catch {
        reason = "invalid";
      }
      if (!reason && ownWrites.length === 0) reason = "noop";
      if (reason) return reject(reason);
      for (const write of ownWrites)
        pending.set(slot(write.module, write.day, write.key), write.value);
      writes.push(...ownWrites);
      changes.push(...ownChanges);
    });
    return { writes, changes, rejected };
  };

  const describe = (change: Change, lang?: string): string => {
    const module = byId.get(change.module);
    if (!module) return change.label;
    try {
      return module.describe(change, messages(module, lang)) || change.label;
    } catch {
      return change.label;
    }
  };

  return {
    modules,
    locales,
    maxOperations,
    get: (id) => byId.get(id),
    find,
    targets: () => targetList,
    messages,
    empty: (layout) => emptyDoc(layout),
    read,
    unreadable,
    state,
    onScreen,
    parse,
    apply,
    resolveRecords,
    describe,
  };
}
