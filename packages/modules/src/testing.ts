import { createKernel } from "./kernel";
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

/**
 * The conformance check of the module contract. It runs a module the way the kernel will and
 * returns every problem it finds, as sentences. An empty list means the module honours the
 * contract; it says nothing about whether the module is useful.
 *
 *     expect(checkModule(habits, { locales: ["es", "en"] })).toEqual([]);
 */
export function checkModule(module: AnyModule, options: { locales: readonly string[] }): string[] {
  const problems: string[] = [];
  const say = (problem: string) => problems.push(problem);
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
    shapes.set(locale, JSON.stringify(shapeOf(t)));
  }
  const [reference, ...others] = [...shapes.entries()];
  for (const [locale, shape] of others) {
    if (reference && shape !== reference[1])
      say(`strings for "${locale}" and "${reference[0]}" do not have the same keys`);
  }

  // Data
  let empty: unknown;
  try {
    empty = module.empty();
    if (!module.schema.safeParse(empty).success) say("empty() does not pass the schema");
    if (JSON.stringify(roundTrip(empty)) !== JSON.stringify(empty))
      say("empty() does not survive JSON");
    if (module.empty() === empty) say("empty() must return a new object every time");
  } catch (error) {
    say(`empty() throws: ${message(error)}`);
  }

  // Assistant
  if (!module.assistant.about.trim()) say("assistant.about is empty");
  try {
    if (empty !== undefined && module.assistant.view) roundTrip(module.assistant.view(empty));
    if (module.assistant.reference && typeof module.assistant.reference() !== "string")
      say("assistant.reference() must return text");
  } catch (error) {
    say(`assistant.view or reference throws: ${message(error)}`);
  }

  // Operations
  const names = Object.keys(module.operations);
  if (names.length === 0) say("a module needs at least one operation");
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
      const second = spec.input.safeParse(first.data);
      if (!second.success || JSON.stringify(second.data) !== JSON.stringify(first.data))
        say(`parsing "${name}" is not idempotent: parsing its own output changes it`);
    });
  }
  if (problems.length > 0) return problems;

  // Behaviour: run every example against an empty document.
  let kernel;
  try {
    kernel = createKernel({ modules: [module], locales });
  } catch (error) {
    return [...problems, `the kernel rejects the module: ${message(error)}`];
  }
  const start = kernel.empty([module.id]);
  const snapshot = JSON.stringify(start);
  for (const [name, spec] of Object.entries(module.operations)) {
    spec.examples.forEach((example, index) => {
      const label = `example ${index + 1} of "${name}"`;
      const result = kernel.apply(start, [{ op: `${module.id}.${name}`, ...example.fields }], {
        newId: sequentialIds(),
      });
      if (JSON.stringify(start) !== snapshot) say(`${label} changes the document it was given`);
      for (const rejection of result.rejected) {
        if (rejection.reason === "invalid")
          say(`${label} leaves data the module's own schema rejects, or throws`);
      }
      checkChanges(result.changes, label);
      const again = kernel.read(roundTrip(result.doc));
      if (kernel.unreadable(again).has(module.id))
        say(`${label} writes data that cannot be read back`);
    });
  }
  for (const [name, spec] of Object.entries(module.records ?? {})) {
    spec.examples.forEach((example, index) => {
      const label = `example ${index + 1} of "${name}"`;
      const result = kernel.resolveRecords(
        start,
        [{ op: `${module.id}.${name}`, ...example.fields }],
        {
          get: () => undefined,
        },
      );
      for (const rejection of result.rejected) {
        if (rejection.reason === "invalid") say(`${label} throws or does not validate`);
      }
      for (const write of result.writes) {
        if (!write.key || write.key.length > 96)
          say(`${label} writes a key outside 1–96 characters`);
        if (JSON.stringify(write.value).length > 2000)
          say(`${label} writes a value over 2000 bytes`);
      }
      checkChanges(result.changes, label);
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

  // Weekly hooks, when the module has them.
  const week = (module as AnyWeekModule).week;
  if (week && empty !== undefined) {
    const t = module.messages[locales[0]!];
    try {
      for (const day of DAY_KEYS) {
        const load = week.load?.(empty, day);
        if (load !== undefined && (!Number.isFinite(load) || load < 0))
          say(`week.load must return a number from 0 up (${day})`);
        week.summary?.(empty, day, t);
        const timeline = week.timeline?.(empty, day, {
          lang: locales[0]!,
          t,
          record: () => undefined,
        });
        for (const span of timeline?.spans ?? []) {
          if (!(span.end > span.start))
            say(`week.timeline returns a span that ends before it starts`);
        }
      }
      week.summary?.(empty, null, t);
    } catch (error) {
      say(`a week hook throws on empty data: ${message(error)}`);
    }
  }

  return problems;
}

const roundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
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
