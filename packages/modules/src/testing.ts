import type { Doc } from "./doc";
import { createKernel, type Kernel, type KernelConfig } from "./kernel";
import { sequentialIds } from "./ids";
import {
  MODULE_ID_PATTERN,
  OPERATION_NAME_PATTERN,
  RESERVED_IDS,
  type AnyModule,
  type Change,
} from "./module";
import { DAY_KEYS } from "./week/days";
import type { AnyWeekModule } from "./week/hooks";

export interface CheckOptions {
  /** The languages the host speaks. */
  locales: readonly string[];
  /**
   * How the host builds its kernel. Pass it so the module is checked with the same fixes to
   * operation fields (day names and the like) that the host applies. Defaults to a plain kernel.
   */
  kernel?: (config: KernelConfig<AnyModule>) => Kernel<AnyModule>;
}

/**
 * The conformance check of the module contract. It runs a module the way the kernel will and
 * returns every problem it finds, as sentences. An empty list means the module honours the
 * contract; it says nothing about whether the module is useful.
 *
 *     expect(checkModule(habits, { locales: ["es", "en"] })).toEqual([]);
 */
export function checkModule(module: AnyModule, options: CheckOptions): string[] {
  const problems: string[] = [];
  const say = (problem: string) => {
    if (!problems.includes(problem)) problems.push(problem);
  };
  const { locales } = options;

  // Identity
  if (!MODULE_ID_PATTERN.test(module.id)) say(`id "${module.id}" must match ${MODULE_ID_PATTERN}`);
  if (RESERVED_IDS.includes(module.id)) say(`id "${module.id}" is reserved`);
  if (!Number.isInteger(module.version) || module.version < 1) say("version must be 1 or more");
  if (!module.tone) say("tone is empty");
  if (!module.icon) say("icon is empty");

  // Strings
  const shapes = new Map<string, string>();
  for (const locale of locales) {
    const t = module.messages[locale];
    if (!t) {
      say(`no strings for "${locale}"`);
      continue;
    }
    if (typeof t.name !== "string" || !t.name.trim()) say(`"${locale}" has no name`);
    if (typeof t.description !== "string" || !t.description.trim())
      say(`"${locale}" has no description`);
    if (typeof t.example !== "string" || !t.example.trim())
      say(`"${locale}" has no example of what to say`);
    shapes.set(locale, JSON.stringify(shapeOf(t)));
  }
  const [reference, ...others] = [...shapes.entries()];
  for (const [locale, shape] of others) {
    if (reference && shape !== reference[1])
      say(`strings for "${locale}" and "${reference[0]}" do not have the same keys`);
  }

  // Data
  let emptyJson: string | undefined;
  try {
    const empty = module.empty();
    emptyJson = JSON.stringify(empty);
    if (!module.schema.safeParse(empty).success) say("empty() does not pass the schema");
    if (JSON.stringify(roundTrip(empty)) !== emptyJson) say("empty() does not survive JSON");
    if (shares(module.empty(), empty))
      say("empty() must return new data every time, with nothing shared between two calls");
  } catch (error) {
    say(`empty() throws: ${message(error)}`);
  }

  if (!module.assistant.about.trim()) say("assistant.about is empty");

  // Operations
  if (Object.keys(module.operations).length === 0) say("a module needs at least one operation");
  const specs = [
    ...Object.entries(module.operations).map(([name, spec]) => ({ name, spec })),
    ...Object.entries(module.records ?? {}).map(([name, spec]) => ({ name, spec })),
  ];
  const seen = new Set<string>();
  for (const { name, spec } of specs) {
    if (!OPERATION_NAME_PATTERN.test(name)) say(`"${name}" is not a valid operation name`);
    if (seen.has(name)) say(`"${name}" is both an operation and a record`);
    seen.add(name);
    if (spec.examples.length === 0) say(`"${name}" has no example`);
    spec.examples.forEach((example, index) => {
      const first = spec.input.safeParse(example.fields);
      if (!first.success) {
        say(`example ${index + 1} of "${name}" does not pass its own input schema`);
        return;
      }
      // Saved operations may be replayed, so reading one twice must give the same thing.
      const second = spec.input.safeParse(first.data);
      if (!second.success || JSON.stringify(second.data) !== JSON.stringify(first.data))
        say(`parsing "${name}" is not idempotent: parsing its own output changes it`);
    });
  }
  if (problems.length > 0 || emptyJson === undefined) return problems;

  // Behaviour: run every example the way the host will.
  let kernel: Kernel<AnyModule>;
  try {
    kernel = (options.kernel ?? createKernel)({ modules: [module], locales });
  } catch (error) {
    return [...problems, `the kernel rejects the module: ${message(error)}`];
  }
  const start = kernel.empty([module.id]);
  const snapshot = JSON.stringify(start);
  /** Every example applied in turn, to have data to look at: frozen, as the host hands it out. */
  let filled: Doc = start;

  for (const [name, spec] of Object.entries(module.operations)) {
    spec.examples.forEach((example, index) => {
      const label = `example ${index + 1} of "${name}"`;
      const operation = { op: `${module.id}.${name}`, ...example.fields };
      // As the assistant sends it (through `parse`) and as a view sends it (straight to `apply`).
      const spoken = kernel.parse([operation]);
      if (spoken.dropped > 0) {
        say(
          `${label} does not validate the way the host reads it: hosts fix some fields before a module sees them, such as day names`,
        );
        return;
      }
      const result = kernel.apply(start, [operation], { newId: sequentialIds() });
      if (JSON.stringify(start) !== snapshot) say(`${label} changes the document it was given`);
      for (const rejection of result.rejected) {
        if (rejection.reason === "invalid")
          say(`${label} leaves data the module's own schema rejects, or throws`);
        if (rejection.reason === "unavailable")
          say(`${label} does not reach the module: the host reads its name as something else`);
      }
      checkChanges(result.changes, label);
      const again = kernel.read(roundTrip(result.doc));
      if (!again || kernel.unreadable(again).has(module.id))
        say(`${label} writes data that cannot be read back`);
      filled = kernel.apply(filled, [operation], { newId: sequentialIds(`${name}${index}`) }).doc;
    });
  }

  const emptyState = kernel.state(start, module);
  const filledState = kernel.state(filled, module);
  const filledJson = JSON.stringify(filledState);

  for (const [name, spec] of Object.entries(module.records ?? {})) {
    spec.examples.forEach((example, index) => {
      const label = `example ${index + 1} of "${name}"`;
      for (const doc of [start, filled]) {
        const result = kernel.resolveRecords(
          doc,
          [{ op: `${module.id}.${name}`, ...example.fields }],
          { get: () => undefined },
        );
        for (const rejection of result.rejected) {
          if (rejection.reason === "invalid")
            say(`${label} throws, does not validate, or tries to change the plan`);
        }
        for (const write of result.writes) {
          if (!write.key || write.key.length > 96)
            say(`${label} writes a key outside 1–96 characters`);
          if (JSON.stringify(write.value).length > 2000)
            say(`${label} writes a value over 2000 bytes`);
        }
        checkChanges(result.changes, label);
      }
    });
  }

  function checkChanges(changes: readonly Change[], label: string) {
    for (const change of changes) {
      if (change.module !== module.id) continue;
      for (const locale of locales) {
        let line = "";
        try {
          line = module.describe(change, module.messages[locale]);
        } catch (error) {
          say(`describe throws for ${label}: ${message(error)}`);
        }
        if (typeof line !== "string" || !line.trim())
          say(`describe returns nothing for ${label} in "${locale}"`);
      }
    }
  }

  // What only reads: the data it is given is frozen, so anything that changes it throws here.
  const t = module.messages[locales[0]!];
  for (const [which, state] of [
    ["empty", emptyState],
    ["filled", filledState],
  ] as const) {
    try {
      if (module.assistant.view) roundTrip(module.assistant.view(state));
    } catch (error) {
      say(`assistant.view fails on ${which} data, or tries to change it: ${message(error)}`);
    }
    const week = (module as AnyWeekModule).week;
    if (!week) continue;
    try {
      for (const day of DAY_KEYS) {
        const load = week.load?.(state, day);
        if (load !== undefined && (!Number.isFinite(load) || load < 0))
          say(`week.load must return a number from 0 up (${day})`);
        week.summary?.(state, day, t);
        const timeline = week.timeline?.(state, day, {
          lang: locales[0]!,
          t,
          record: () => undefined,
        });
        for (const span of timeline?.spans ?? []) {
          if (!(span.end > span.start))
            say("week.timeline returns a span that ends before it starts");
        }
      }
      week.summary?.(state, null, t);
    } catch (error) {
      say(`a week hook fails on ${which} data, or tries to change it: ${message(error)}`);
    }
  }
  try {
    if (module.assistant.reference && typeof module.assistant.reference() !== "string")
      say("assistant.reference() must return text");
  } catch (error) {
    say(`assistant.reference throws: ${message(error)}`);
  }

  // Nothing above may have left a mark on data it only had to read, or on what empty() returns.
  if (JSON.stringify(filledState) !== filledJson) say("reading the data changed it");
  try {
    if (JSON.stringify(module.empty()) !== emptyJson)
      say("empty() does not return the same data every time");
  } catch (error) {
    say(`empty() throws: ${message(error)}`);
  }

  return problems;
}

const roundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Whether two values have an object or a list in common, at any depth. */
function shares(a: unknown, b: unknown): boolean {
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (a === b) return true;
  return Object.entries(a).some(([key, inner]) =>
    shares(inner, (b as Record<string, unknown>)[key]),
  );
}
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** The structure of a strings object: its keys and the kind of each value, not the words. */
function shapeOf(value: unknown): unknown {
  if (typeof value === "function") return "function";
  if (Array.isArray(value)) return value.map(shapeOf);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, inner]) => [key, shapeOf(inner)]),
    );
  }
  return typeof value;
}
